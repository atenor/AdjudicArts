export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getScoringApplicationForJudge } from "@/lib/db/scores";

const compileRequestSchema = z.object({
  notes: z
    .array(
      z.object({
        criteriaId: z.string().min(1),
        value: z.number().min(0).max(10).nullable().optional(),
        comment: z.string().min(1),
      })
    )
    .min(1),
  existingFinalComment: z.string().optional().nullable(),
});

function toSentence(text: string) {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function buildCompiledComment(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  judgeName: string,
  existingFinalComment?: string | null
) {
  const noteLines = notes.map((note) => {
    const scorePart =
      typeof note.value === "number" && !Number.isNaN(note.value)
        ? ` (${note.value}/10)`
        : "";
    return `- ${note.criterionName}${scorePart}: ${toSentence(note.comment)}`;
  });

  const opening = "ADJUDICARTS FEEDBACK SUMMARY";
  const intro =
    "Thank you for your submission. The following feedback reflects your adjudication notes.";
  const heading = "Rubric Feedback";
  const existing = toSentence(existingFinalComment ?? "");
  const finalHeading = "Final Comments";
  const preparedBy = `Prepared by: ${judgeName}`;
  const closing =
    "Thank you for your work and preparation. We hope these notes support your continued growth.";

  return [
    opening,
    "",
    intro,
    "",
    heading,
    ...noteLines,
    "",
    finalHeading,
    existing || "No final comments provided.",
    "",
    preparedBy,
    closing,
  ].join("\n");
}

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

  const parsed = compileRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const criterionNameById = new Map(
    scoringContext.criteria.map((criterion) => [criterion.id, criterion.name])
  );

  const normalizedNotes = parsed.data.notes
    .map((note) => ({
      criterionName: criterionNameById.get(note.criteriaId),
      comment: note.comment.trim(),
      value: note.value ?? null,
    }))
    .filter(
      (note): note is { criterionName: string; comment: string; value: number | null } =>
        Boolean(note.criterionName) && note.comment.length > 0
    );

  if (normalizedNotes.length === 0) {
    return Response.json(
      { error: "At least one rubric note is required for compilation." },
      { status: 422 }
    );
  }

  const compiledComment = buildCompiledComment(
    normalizedNotes,
    session.user.name ?? "Adjudication Judge",
    parsed.data.existingFinalComment ?? null
  );

  return Response.json({ compiledComment });
}
