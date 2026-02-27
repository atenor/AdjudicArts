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

function extractFirstName(fullName: string) {
  const normalized = fullName.replace(/\s+/g, " ").trim();
  if (!normalized) return "Applicant";
  return normalized.split(" ")[0] ?? "Applicant";
}

function findCriterionNotes(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  keywords: string[]
) {
  return notes.filter((note) =>
    keywords.some((keyword) =>
      note.criterionName.toLowerCase().includes(keyword.toLowerCase())
    )
  );
}

function buildCompiledComment(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  applicantName: string,
  existingFinalComment?: string | null
) {
  const firstName = extractFirstName(applicantName);
  const seen = new Set<string>();
  const notesWithUniqueComments = notes
    .map((note) => ({
      ...note,
      comment: note.comment.replace(/\s+/g, " ").trim(),
    }))
    .filter((note) => note.comment.length > 0)
    .filter((note) => {
      const key = note.comment.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const techniqueNotes = findCriterionNotes(notesWithUniqueComments, [
    "vocal technique",
    "technique",
    "breath",
    "tone",
    "intonation",
    "accuracy",
  ]).map((note) => note.comment.replace(/\s+/g, " ").trim());

  const musicalityNotes = findCriterionNotes(notesWithUniqueComments, [
    "musicality",
    "style",
    "stylistic",
    "repertoire",
    "artistic potential",
    "x-factor",
  ]).map((note) => note.comment.replace(/\s+/g, " ").trim());

  const dictionNotes = findCriterionNotes(notesWithUniqueComments, [
    "diction",
    "language",
  ]).map((note) =>
    note.comment.replace(/\s+/g, " ").trim()
  );

  const actingNotes = findCriterionNotes(notesWithUniqueComments, [
    "acting",
    "interpretation",
    "stage presence",
    "presence",
  ]).map((note) => note.comment.replace(/\s+/g, " ").trim());

  const usedComments = new Set([
    ...techniqueNotes,
    ...musicalityNotes,
    ...dictionNotes,
    ...actingNotes,
  ]);

  const remainingNotes = notesWithUniqueComments
    .map((note) => note.comment.replace(/\s+/g, " ").trim())
    .filter((comment) => !usedComments.has(comment));

  const openingParagraph = toParagraph([
    "Thank you for sharing your performance.",
    "You did very good work, and there is much to commend in your performance.",
  ]);

  const techniqueParagraph = techniqueNotes.length
    ? toParagraph([
        "Your technique shows a strong foundation.",
        ...techniqueNotes,
      ])
    : "";

  const musicalityParagraph = musicalityNotes.length
    ? toParagraph([
        "Musically, there were several strong choices in your performance.",
        ...musicalityNotes,
      ])
    : "";

  const dictionParagraph = dictionNotes.length
    ? toParagraph([
        "Your diction and language work is generally solid.",
        ...dictionNotes,
      ])
    : "";

  const actingParagraph = actingNotes.length
    ? toParagraph([
        "In acting and stage presence, there are clear strengths to build on.",
        ...actingNotes,
      ])
    : "";

  const additionalParagraph =
    remainingNotes.length > 0
      ? toParagraph([
          "Additional feedback from your rubric comments includes the following:",
          ...remainingNotes,
        ])
      : "";

  const finalRemarks = sanitizeJudgeFinalComment(existingFinalComment);
  const finalRemarksParagraph = finalRemarks
    ? toParagraph([
        finalRemarks,
        "Overall, you show strong potential and we look forward to your continued growth.",
      ])
    : toParagraph([
        "Overall, you show strong potential and we look forward to your continued growth.",
      ]);

  return [
    `Dear ${firstName},`,
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
    parsed.data.existingFinalComment ?? null
  );

  return Response.json({ compiledComment });
}
