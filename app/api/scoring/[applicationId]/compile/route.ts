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

  const finalRemarks = sanitizeJudgeFinalComment(existingFinalComment);
  const formatBulletLines = (lines: string[]) =>
    lines.map((line) => `- ${toSentence(line)}`).join("\n");

  const sections: string[] = [];

  if (techniqueNotes.length > 0) {
    sections.push(["Technique", formatBulletLines(techniqueNotes)].join("\n"));
  }
  if (musicalityNotes.length > 0) {
    sections.push(["Musicality and Style", formatBulletLines(musicalityNotes)].join("\n"));
  }
  if (dictionNotes.length > 0) {
    sections.push(["Diction and Language", formatBulletLines(dictionNotes)].join("\n"));
  }
  if (actingNotes.length > 0) {
    sections.push(["Acting and Stage Presence", formatBulletLines(actingNotes)].join("\n"));
  }
  if (remainingNotes.length > 0) {
    sections.push(["Additional Notes", formatBulletLines(remainingNotes)].join("\n"));
  }

  const finalSection = finalRemarks
    ? ["Judge Final Comment", formatBulletLines([finalRemarks])].join("\n")
    : "";

  return [
    "Applicant Feedback Outline",
    `Applicant: ${firstName}`,
    "",
    ...sections,
    ...(finalSection ? ["", finalSection] : []),
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n\n");
}

function buildAiPrompt(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  applicantName: string,
  existingFinalComment?: string | null
) {
  const firstName = extractFirstName(applicantName);
  const normalizedNotes = notes.map((note) => ({
    criterionName: note.criterionName,
    score:
      typeof note.value === "number" && Number.isFinite(note.value)
        ? `${note.value}/10`
        : null,
    quickNote: note.comment.trim(),
  }));

  const cleanedFinalComment = sanitizeJudgeFinalComment(existingFinalComment);

  return `
You are writing an applicant-facing adjudication letter.

Output requirements:
- Write only the final letter text.
- Start with: Dear ${firstName},
- Use complete paragraphs, not bullet points, not rubric listing.
- Warm, encouraging, professional tone.
- No em dash characters.
- Do not exaggerate.
- Do not add claims not present in source notes.
- Do not add technical critiques not present in source notes.
- Do not add career advice.

Structure:
1) Opening thanks paragraph.
2) Technique paragraph (if technique-related notes exist).
3) Musicality/style paragraph (if such notes exist).
4) Diction/language paragraph (if such notes exist).
5) Acting/stage presence paragraph (if such notes exist).
6) Closing paragraph grounded in the provided final comment (if present).

Source data (use only this content):
Applicant Name: ${applicantName}
Rubric Notes JSON:
${JSON.stringify(normalizedNotes, null, 2)}

Judge Final Comment:
${cleanedFinalComment || "(none provided)"}
`.trim();
}

async function generateAiCompiledComment(
  notes: Array<{ criterionName: string; comment: string; value?: number | null }>,
  applicantName: string,
  existingFinalComment?: string | null
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_FEEDBACK_MODEL || "gpt-4o-mini";
  const prompt = buildAiPrompt(notes, applicantName, existingFinalComment);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You produce concise, honest, encouraging adjudication letters from provided notes only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return content;
  } catch {
    return null;
  }
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

  const aiCompiledComment = await generateAiCompiledComment(
    normalizedNotes,
    scoringContext.application.applicant.name,
    parsed.data.existingFinalComment ?? null
  );

  const compiledComment =
    aiCompiledComment ??
    buildCompiledComment(
    normalizedNotes,
    scoringContext.application.applicant.name,
    parsed.data.existingFinalComment ?? null
  );

  return Response.json({ compiledComment });
}
