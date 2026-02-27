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

function toParagraph(lines: string[]) {
  const normalized = lines.map((line) => toSentence(line)).filter(Boolean);
  if (normalized.length === 0) return "";
  return normalized.join(" ");
}

function sanitizeJudgeFinalComment(input: string | null | undefined) {
  const raw = (input ?? "").trim();
  if (!raw) return "";

  // Remove legacy boilerplate that may have been saved in older versions.
  const blockedPatterns = [
    /^summary of rubric feedback:/i,
    /^rubric feedback:/i,
    /^prepared by:/i,
    /^dear\s+/i,
    /^adjudicarts feedback summary$/i,
    /^final comments$/i,
  ];

  const cleanedLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !blockedPatterns.some((pattern) => pattern.test(line)));

  const cleaned = cleanedLines.join(" ");
  // If legacy sentence exists inline, trim it away.
  return cleaned
    .replace(
      /overall,\s*these notes represent the judge'?s rationale and can be refined before final submission\.?/gi,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function findCriterionNote(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  keywords: string[]
) {
  return notes.find((note) =>
    keywords.some((keyword) =>
      note.criterionName.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

function buildCompiledComment(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  applicantName: string,
  judgeName: string,
  existingFinalComment?: string | null
) {
  const techniqueNotes = [
    findCriterionNote(notes, ["vocal technique", "technique", "breath", "tone", "intonation"]),
    findCriterionNote(notes, ["tone quality", "tone"]),
    findCriterionNote(notes, ["intonation", "accuracy"]),
  ]
    .filter((note): note is { criterionName: string; comment: string; value?: number | null } => Boolean(note))
    .map((note) => note.comment);

  const musicalityNotes = [
    findCriterionNote(notes, ["musicality", "style", "stylistic", "repertoire"]),
    findCriterionNote(notes, ["stylistic appropriateness"]),
  ]
    .filter((note): note is { criterionName: string; comment: string; value?: number | null } => Boolean(note))
    .map((note) => note.comment);

  const dictionNotes = [
    findCriterionNote(notes, ["diction", "language"]),
  ]
    .filter((note): note is { criterionName: string; comment: string; value?: number | null } => Boolean(note))
    .map((note) => note.comment);

  const actingNotes = [
    findCriterionNote(notes, ["acting", "interpretation", "stage presence", "presence"]),
  ]
    .filter((note): note is { criterionName: string; comment: string; value?: number | null } => Boolean(note))
    .map((note) => note.comment);

  const remainingNotes = notes
    .filter(
      (note) =>
        !techniqueNotes.includes(note.comment) &&
        !musicalityNotes.includes(note.comment) &&
        !dictionNotes.includes(note.comment) &&
        !actingNotes.includes(note.comment)
    )
    .map((note) => note.comment);

  const openingParagraph = toParagraph([
    "Thank you for sharing your performance.",
    "The following adjudication feedback reflects your rubric notes and final comments.",
  ]);
  const techniqueParagraph = toParagraph(techniqueNotes);
  const musicalityParagraph = toParagraph(musicalityNotes);
  const dictionParagraph = toParagraph(dictionNotes);
  const actingParagraph = toParagraph(actingNotes);
  const additionalParagraph = toParagraph(remainingNotes);
  const finalRemarksParagraph = toParagraph([
    sanitizeJudgeFinalComment(existingFinalComment),
    "Prepared by: " + judgeName,
  ]);

  return [
    `Dear ${applicantName},`,
    "",
    openingParagraph,
    techniqueParagraph,
    musicalityParagraph,
    dictionParagraph,
    actingParagraph,
    additionalParagraph,
    finalRemarksParagraph,
  ]
    .filter((paragraph) => paragraph.trim().length > 0)
    .join("\n\n");
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
    scoringContext.application.applicant.name,
    session.user.name ?? "Adjudication Judge",
    parsed.data.existingFinalComment ?? null
  );

  return Response.json({ compiledComment });
}
