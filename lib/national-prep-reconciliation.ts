import { ApplicationStatus, Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  CHAPTER_ADJUDICATION_STATUSES,
  advanceApplicationStatusWithPermissions,
  updateApplicationProfile,
} from "@/lib/db/applications";

export type NationalPrepRosterRow = {
  chapter: string;
  firstName: string;
  lastName: string;
  expectedAge: number | null;
};

export type NationalPrepMatchStatus =
  | "unique_match"
  | "no_match"
  | "ambiguous"
  | "pending_chapter"
  | "invalid_dob";

export type NationalPrepRecommendedAction =
  | "correct_chapter"
  | "correct_and_advance"
  | "none"
  | "manual_review";

export type NationalPrepMatchPreview = {
  rosterRow: NationalPrepRosterRow;
  matchStatus: NationalPrepMatchStatus;
  applicationId?: string;
  applicationName?: string;
  currentChapter?: string | null;
  targetChapter?: string;
  currentStatus?: ApplicationStatus;
  dobAge?: number | null;
  recommendedAction: NationalPrepRecommendedAction;
  reasons: string[];
  canCorrectChapter: boolean;
  canAdvance: boolean;
  selectedByDefault: boolean;
};

export type NationalPrepSummary = {
  totalRows: number;
  uniqueMatches: number;
  noMatches: number;
  ambiguousMatches: number;
  needsReview: number;
  readyToCorrect: number;
  readyToAdvance: number;
  corrected?: number;
  advanced?: number;
  blocked?: number;
};

export type NationalPrepApplyResult = {
  preview: NationalPrepMatchPreview[];
  summary: NationalPrepSummary;
};

type ReconciliationApplication = {
  id: string;
  status: ApplicationStatus;
  chapter: string | null;
  dateOfBirth: Date | null;
  notes: string | null;
  applicant: {
    name: string;
  };
};

type BuildPreviewInput = {
  organizationId: string;
  rosterText: string;
};

type ApplyPreviewInput = BuildPreviewInput & {
  actorUserId: string;
  actorRole: Role;
  actorChapter?: string | null;
  actorLabel: string;
  selectedApplicationIds?: string[];
  applyChapterCorrections?: boolean;
  applyNationalAdvancement?: boolean;
};

const RECONCILIATION_REASON = "National prep roster reconciliation";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeName(value: string) {
  return normalizeWhitespace(
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .toLowerCase()
  );
}

function normalizeChapter(value: string | null | undefined) {
  return normalizeWhitespace(
    (value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[–—]/g, "-")
      .toLowerCase()
  );
}

function getAge(dateOfBirth: Date | null | undefined, now = new Date()) {
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) return null;

  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = now.getMonth() - dateOfBirth.getMonth();
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && now.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

function parseNotesObject(notes: string | null) {
  if (!notes || notes.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(notes) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }
  return {};
}

function isCitizenshipVerified(notes: string | null) {
  const notesObject = parseNotesObject(notes);
  const verification = notesObject.citizenshipVerification;
  return Boolean(
    verification &&
      typeof verification === "object" &&
      (verification as { verified?: unknown }).verified === true
  );
}

function splitLine(line: string) {
  if (line.includes("\t")) {
    return line.split("\t").map((part) => part.trim());
  }

  const parts = line
    .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
    .map((part) => part.replace(/^"(.*)"$/, "$1").trim());

  return parts;
}

export function parseNationalPrepRosterText(rosterText: string): NationalPrepRosterRow[] {
  const lines = rosterText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const rows: NationalPrepRosterRow[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parts = splitLine(line);
    if (parts.length < 4) continue;

    const isHeader =
      index === 0 &&
      normalizeName(parts[0]).includes("chapter") &&
      normalizeName(parts[1]).includes("age") &&
      normalizeName(parts[2]).includes("first") &&
      normalizeName(parts[3]).includes("last");

    if (isHeader) continue;

    const [chapter, ageRaw, firstName, lastName] = parts;
    if (!chapter || !firstName || !lastName) continue;

    const numericAge = Number(ageRaw);
    rows.push({
      chapter,
      firstName,
      lastName,
      expectedAge: Number.isFinite(numericAge) ? numericAge : null,
    });
  }

  return rows;
}

function isPendingChapterForThisPass(chapter: string) {
  const normalized = normalizeChapter(chapter);
  return normalized.includes("new york") || normalized.includes("pennsylvania");
}

function isAdvanceEligibleStatus(status: ApplicationStatus) {
  return CHAPTER_ADJUDICATION_STATUSES.includes(status);
}

function namesMatch(
  applicationName: string,
  rosterRow: NationalPrepRosterRow
) {
  const normalizedApplicationName = normalizeName(applicationName);
  const fullTarget = normalizeName(`${rosterRow.firstName} ${rosterRow.lastName}`);
  const firstTarget = normalizeName(rosterRow.firstName);
  const lastTarget = normalizeName(rosterRow.lastName);

  if (normalizedApplicationName === fullTarget) return true;
  return (
    normalizedApplicationName.includes(firstTarget) &&
    normalizedApplicationName.includes(lastTarget)
  );
}

function chaptersDiffer(
  currentChapter: string | null | undefined,
  targetChapter: string
) {
  return normalizeChapter(currentChapter) !== normalizeChapter(targetChapter);
}

function buildSummary(preview: NationalPrepMatchPreview[], counts?: {
  corrected?: number;
  advanced?: number;
  blocked?: number;
}): NationalPrepSummary {
  return {
    totalRows: preview.length,
    uniqueMatches: preview.filter((row) => row.matchStatus === "unique_match").length,
    noMatches: preview.filter((row) => row.matchStatus === "no_match").length,
    ambiguousMatches: preview.filter((row) => row.matchStatus === "ambiguous").length,
    needsReview: preview.filter(
      (row) =>
        row.matchStatus !== "unique_match" ||
        row.recommendedAction === "manual_review"
    ).length,
    readyToCorrect: preview.filter((row) => row.canCorrectChapter).length,
    readyToAdvance: preview.filter((row) => row.canAdvance).length,
    corrected: counts?.corrected ?? 0,
    advanced: counts?.advanced ?? 0,
    blocked: counts?.blocked ?? 0,
  };
}

async function listCandidateApplications(organizationId: string) {
  return prisma.application.findMany({
    where: { organizationId },
    select: {
      id: true,
      status: true,
      chapter: true,
      dateOfBirth: true,
      notes: true,
      applicant: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ submittedAt: "asc" }],
  });
}

export async function buildNationalPrepPreview(
  input: BuildPreviewInput
): Promise<NationalPrepApplyResult> {
  const rosterRows = parseNationalPrepRosterText(input.rosterText);
  const applications = await listCandidateApplications(input.organizationId);

  const preview = rosterRows.map((rosterRow) =>
    buildPreviewRow(rosterRow, applications)
  );

  return {
    preview,
    summary: buildSummary(preview),
  };
}

function buildPreviewRow(
  rosterRow: NationalPrepRosterRow,
  applications: ReconciliationApplication[]
): NationalPrepMatchPreview {
  const matches = applications.filter((application) =>
    namesMatch(application.applicant.name, rosterRow)
  );

  if (matches.length === 0) {
    return {
      rosterRow,
      matchStatus: "no_match",
      recommendedAction: "manual_review",
      reasons: ["No application match found in the organization."],
      canCorrectChapter: false,
      canAdvance: false,
      selectedByDefault: false,
    };
  }

  if (matches.length > 1) {
    return {
      rosterRow,
      matchStatus: "ambiguous",
      recommendedAction: "manual_review",
      reasons: ["More than one plausible application match was found."],
      canCorrectChapter: false,
      canAdvance: false,
      selectedByDefault: false,
    };
  }

  const match = matches[0];
  const dobAge = getAge(match.dateOfBirth);
  const invalidDob = dobAge === null;
  const pendingChapter = isPendingChapterForThisPass(rosterRow.chapter);
  const needsChapterCorrection = chaptersDiffer(match.chapter, rosterRow.chapter);
  const eligibleByStatus = isAdvanceEligibleStatus(match.status);
  const citizenshipVerified = isCitizenshipVerified(match.notes);
  const alreadyPending = match.status === "PENDING_NATIONAL_ACCEPTANCE";
  const alreadyNational =
    match.status === "APPROVED_FOR_NATIONAL_ADJUDICATION" ||
    match.status === "NATIONAL_FINALS" ||
    match.status === "NATIONAL_REVIEW" ||
    match.status === "NATIONAL_APPROVED" ||
    match.status === "NATIONAL_REJECTED" ||
    match.status === "DECIDED";

  const reasons: string[] = [];
  if (pendingChapter) {
    reasons.push("New York and Pennsylvania are excluded from this prep pass.");
  }
  if (invalidDob) {
    reasons.push("Application date of birth is invalid or missing.");
  }
  if (!citizenshipVerified && eligibleByStatus) {
    reasons.push("Citizenship is not verified, so national advancement is blocked.");
  }
  if (alreadyPending) {
    reasons.push("Already pending national acceptance.");
  }
  if (alreadyNational) {
    reasons.push("Already in or beyond the national adjudication pipeline.");
  }
  if (!eligibleByStatus && !alreadyPending && !alreadyNational) {
    reasons.push(`Current status ${match.status} is not chapter-ready for national prep.`);
  }
  if (!needsChapterCorrection) {
    reasons.push("Stored chapter already matches the roster.");
  }

  const canCorrectChapter =
    !pendingChapter && !invalidDob && needsChapterCorrection;
  const canAdvance =
    !pendingChapter &&
    !invalidDob &&
    !alreadyPending &&
    !alreadyNational &&
    eligibleByStatus &&
    citizenshipVerified;

  const recommendedAction = pendingChapter || invalidDob
    ? "manual_review"
    : canCorrectChapter && canAdvance
      ? "correct_and_advance"
      : canCorrectChapter
        ? "correct_chapter"
        : "none";

  return {
    rosterRow,
    matchStatus: pendingChapter
      ? "pending_chapter"
      : invalidDob
        ? "invalid_dob"
        : "unique_match",
    applicationId: match.id,
    applicationName: match.applicant.name,
    currentChapter: match.chapter,
    targetChapter: rosterRow.chapter,
    currentStatus: match.status,
    dobAge,
    recommendedAction,
    reasons,
    canCorrectChapter,
    canAdvance,
    selectedByDefault: canCorrectChapter || canAdvance,
  };
}

export async function applyNationalPrepReconciliation(
  input: ApplyPreviewInput
): Promise<NationalPrepApplyResult> {
  const initial = await buildNationalPrepPreview({
    organizationId: input.organizationId,
    rosterText: input.rosterText,
  });

  const selectedIds = new Set(
    (input.selectedApplicationIds ?? [])
      .map((id) => id.trim())
      .filter(Boolean)
  );

  let corrected = 0;
  let advanced = 0;
  let blocked = 0;

  for (const row of initial.preview) {
    if (!row.applicationId) {
      blocked += 1;
      continue;
    }

    const isSelected =
      selectedIds.size === 0 ? row.selectedByDefault : selectedIds.has(row.applicationId);

    if (!isSelected) continue;

    let didSomething = false;

    if (input.applyChapterCorrections && row.canCorrectChapter) {
      await updateApplicationProfile({
        id: row.applicationId,
        organizationId: input.organizationId,
        chapter: row.targetChapter,
        actor: input.actorLabel,
        actorRole: input.actorRole,
        chapterChangeNote: RECONCILIATION_REASON,
      });
      corrected += 1;
      didSomething = true;
    }

    if (input.applyNationalAdvancement && row.canAdvance && row.currentStatus) {
      const result = await advanceApplicationStatusWithPermissions({
        id: row.applicationId,
        nextStatus: "PENDING_NATIONAL_ACCEPTANCE",
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        actorChapter: input.actorChapter,
        reason: RECONCILIATION_REASON,
      });

      if (result.reason === "OK") {
        advanced += 1;
        didSomething = true;
      } else {
        blocked += 1;
      }
    } else if (
      input.applyNationalAdvancement &&
      isSelected &&
      !row.canAdvance
    ) {
      blocked += 1;
    }

    if (!didSomething && input.applyChapterCorrections && !row.canCorrectChapter && !input.applyNationalAdvancement) {
      blocked += 1;
    }
  }

  const refreshed = await buildNationalPrepPreview({
    organizationId: input.organizationId,
    rosterText: input.rosterText,
  });

  return {
    preview: refreshed.preview,
    summary: buildSummary(refreshed.preview, { corrected, advanced, blocked }),
  };
}
