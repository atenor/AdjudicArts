export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import {
  getScoringApplicationForJudge,
  packScoreComment,
  upsertScore,
} from "@/lib/db/scores";

const scoreSchema = z.object({
  criteriaId: z.string().min(1),
  value: z.number().min(0).max(10),
  comment: z.string().optional().nullable(),
});

const requestSchema = z.object({
  scores: z.array(scoreSchema).min(1),
  finalComment: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const scoringContext = await getScoringApplicationForJudge(
    params.applicationId,
    session.user.id,
    session.user.organizationId,
    session.user.role
  );

  if (!scoringContext) {
    return Response.json({ error: "Application is not available for scoring" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const criteriaIds = scoringContext.criteria.map((criterion) => criterion.id);
  const firstCriteriaId = criteriaIds[0];
  const receivedCriteriaIds = parsed.data.scores.map((score) => score.criteriaId);

  const allIncluded =
    criteriaIds.length === receivedCriteriaIds.length &&
    criteriaIds.every((criteriaId) => receivedCriteriaIds.includes(criteriaId));

  if (!allIncluded) {
    return Response.json(
      { error: "Scores must include all rubric criteria exactly once" },
      { status: 422 }
    );
  }

  await Promise.all(
    parsed.data.scores.map((score) =>
      upsertScore({
        organizationId: session.user.organizationId,
        applicationId: params.applicationId,
        criteriaId: score.criteriaId,
        judgeId: session.user.id,
        round: scoringContext.scoreRound,
        value: score.value,
        comment:
          score.criteriaId === firstCriteriaId
            ? packScoreComment(score.comment ?? null, parsed.data.finalComment ?? null)
            : score.comment ?? null,
      })
    )
  );

  return Response.json({ success: true });
}
