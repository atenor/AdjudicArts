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
import {
  replaceJudgePrizeSuggestions,
  touchJudgeSubmissionDraft,
} from "@/lib/db/governance";

const scoreSchema = z.object({
  criteriaId: z.string().min(1),
  value: z.number().min(0).max(10),
  comment: z.string().optional().nullable(),
});

const requestSchema = z.object({
  scores: z.array(scoreSchema).min(1),
  finalComment: z.string().optional().nullable(),
  prizeSuggestions: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        amountCents: z.number().int().nonnegative().nullable().optional(),
        comment: z.string().trim().nullable().optional(),
      })
    )
    .optional()
    .default([]),
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
    session.user.role,
    session.user.chapter
  );

  if (!scoringContext) {
    return Response.json({ error: "Application is not available for scoring" }, { status: 404 });
  }

  if (scoringContext.certification) {
    return Response.json(
      { error: "This round is certified and no further score edits are allowed." },
      { status: 409 }
    );
  }

  if (scoringContext.submission?.status === "FINALIZED") {
    return Response.json(
      { error: "This submission has been finalized and cannot be edited." },
      { status: 409 }
    );
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

  const draftResult = await touchJudgeSubmissionDraft({
    organizationId: session.user.organizationId,
    eventId: scoringContext.application.event.id,
    roundId: scoringContext.round.id,
    applicationId: params.applicationId,
    judgeId: session.user.id,
  });

  if (draftResult.reason !== "OK") {
    return Response.json(
      {
        error:
          draftResult.reason === "ROUND_CERTIFIED"
            ? "This round is certified and no further score edits are allowed."
            : "This submission has been finalized and cannot be edited.",
      },
      { status: 409 }
    );
  }

  const suggestionResult = await replaceJudgePrizeSuggestions({
    organizationId: session.user.organizationId,
    eventId: scoringContext.application.event.id,
    roundId: scoringContext.round.id,
    applicationId: params.applicationId,
    judgeId: session.user.id,
    suggestions: parsed.data.prizeSuggestions.map((suggestion) => ({
      label: suggestion.label,
      amountCents: suggestion.amountCents ?? null,
      comment: suggestion.comment ?? null,
    })),
  });

  if (suggestionResult.reason !== "OK") {
    return Response.json(
      {
        error:
          suggestionResult.reason === "ROUND_CERTIFIED"
            ? "This round is certified and no further prize suggestion edits are allowed."
            : "This submission has been finalized and cannot be edited.",
      },
      { status: 409 }
    );
  }

  return Response.json({ success: true });
}
