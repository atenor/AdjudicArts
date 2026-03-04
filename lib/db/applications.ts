import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Prisma, Role, RoundType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { buildApplicationMetadata } from "@/lib/application-metadata";
import { getRankedResultsForRound } from "@/lib/db/results";
import {
  getCompetitionCutoffDate,
  resolveApplicationDivision,
  type ApplicationDivision,
} from "@/lib/application-division";

export const PENDING_APPROVAL_STATUSES: ApplicationStatus[] = [
  "PENDING_APPROVAL",
  "SUBMITTED_PENDING_APPROVAL",
  "SUBMITTED",
];

export const CORRECTION_REQUIRED_STATUSES: ApplicationStatus[] = [
  "CORRECTION_REQUIRED",
];

export const CHAPTER_ADJUDICATION_STATUSES: ApplicationStatus[] = [
  "APPROVED_FOR_CHAPTER_ADJUDICATION",
  "CHAPTER_ADJUDICATION",
  "CHAPTER_REVIEW",
];

export const NATIONAL_FINALS_STATUSES: ApplicationStatus[] = [
  "PENDING_NATIONAL_ACCEPTANCE",
  "CHAPTER_APPROVED",
  "APPROVED_FOR_NATIONAL_ADJUDICATION",
  "NATIONAL_FINALS",
  "NATIONAL_REVIEW",
];

export const PENDING_NATIONAL_ACCEPTANCE_STATUSES: ApplicationStatus[] = [
  "PENDING_NATIONAL_ACCEPTANCE",
  "CHAPTER_APPROVED",
];

export const NON_SCORING_TERMINAL_STATUSES: ApplicationStatus[] = [
  "EXCLUDED",
  "ALTERNATE",
  "DID_NOT_ADVANCE",
  "WITHDRAWN",
  "CHAPTER_REJECTED",
  "NATIONAL_REJECTED",
  "NATIONAL_APPROVED",
  "DECIDED",
];

const NON_FORWARD_STATUSES: ApplicationStatus[] = [
  "PENDING_APPROVAL",
  "CORRECTION_REQUIRED",
  "SUBMITTED_PENDING_APPROVAL",
  "SUBMITTED",
  "EXCLUDED",
  "ALTERNATE",
  "DID_NOT_ADVANCE",
  "WITHDRAWN",
  "CHAPTER_REJECTED",
  "NATIONAL_REJECTED",
];

function normalizeChapter(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function chapterMatchKey(value: string | null | undefined) {
  const normalized = normalizeChapter(value);
  if (!normalized) return "";

  const withoutParens = normalized.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const base = withoutParens.split(/[–—-]/)[0]?.trim() ?? withoutParens;
  return base.replace(/\bchapter\b/g, "").replace(/\s+/g, " ").trim();
}

function isChapterMatch(
  applicationChapter: string | null | undefined,
  userChapter: string | null | undefined
) {
  const app = chapterMatchKey(applicationChapter);
  const user = chapterMatchKey(userChapter);
  if (!app || !user) return false;
  if (app === user) return true;
  if (app.length >= 3 && user.includes(app)) return true;
  if (user.length >= 3 && app.includes(user)) return true;
  return false;
}

function buildChapterFilterWhere(chapter: string): Prisma.ApplicationWhereInput {
  const normalizedChapter = normalizeChapter(chapter);
  const chapterKey = chapterMatchKey(chapter);
  const canUseContains = chapterKey.length >= 3;

  if (!normalizedChapter) {
    return { id: "__none__" };
  }

  if (!canUseContains) {
    return {
      chapter: {
        equals: normalizedChapter,
        mode: "insensitive",
      },
    };
  }

  return {
    OR: [
      {
        chapter: {
          equals: normalizedChapter,
          mode: "insensitive",
        },
      },
      {
        chapter: {
          contains: chapterKey,
          mode: "insensitive",
        },
      },
    ],
  };
}

function isInStatusSet(status: ApplicationStatus, statuses: ApplicationStatus[]) {
  return statuses.includes(status);
}

export function getAllowedApplicationStatusesForRole(role: Role): ApplicationStatus[] {
  if (role === "ADMIN" || role === "NATIONAL_CHAIR") {
    return [
      "PENDING_APPROVAL",
      "CORRECTION_REQUIRED",
      "APPROVED_FOR_CHAPTER_ADJUDICATION",
      "PENDING_NATIONAL_ACCEPTANCE",
      "APPROVED_FOR_NATIONAL_ADJUDICATION",
      "ALTERNATE",
      "DID_NOT_ADVANCE",
      "EXCLUDED",
      "WITHDRAWN",
      "SUBMITTED_PENDING_APPROVAL",
      "CHAPTER_ADJUDICATION",
      "NATIONAL_FINALS",
      "SUBMITTED",
      "CHAPTER_REVIEW",
      "CHAPTER_APPROVED",
      "CHAPTER_REJECTED",
      "NATIONAL_REVIEW",
      "NATIONAL_APPROVED",
      "NATIONAL_REJECTED",
      "DECIDED",
    ];
  }
  if (role === "CHAPTER_CHAIR") {
    return [
      ...PENDING_APPROVAL_STATUSES,
      ...CORRECTION_REQUIRED_STATUSES,
      ...CHAPTER_ADJUDICATION_STATUSES,
      ...PENDING_NATIONAL_ACCEPTANCE_STATUSES,
      "ALTERNATE",
      "DID_NOT_ADVANCE",
      "EXCLUDED",
      "WITHDRAWN",
    ];
  }
  if (role === "CHAPTER_JUDGE") {
    return [...CHAPTER_ADJUDICATION_STATUSES];
  }
  if (role === "NATIONAL_JUDGE") {
    return [...NATIONAL_FINALS_STATUSES];
  }
  return [];
}

export function canViewApplicationByRole(input: {
  role: Role;
  status: ApplicationStatus;
  applicationChapter?: string | null;
  userChapter?: string | null;
}) {
  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") return true;

  if (input.role === "CHAPTER_CHAIR") {
    return isChapterMatch(input.applicationChapter, input.userChapter);
  }

  if (input.role === "CHAPTER_JUDGE") {
    return (
      isChapterMatch(input.applicationChapter, input.userChapter) &&
      isInStatusSet(input.status, CHAPTER_ADJUDICATION_STATUSES)
    );
  }

  if (input.role === "NATIONAL_JUDGE") {
    return isInStatusSet(input.status, NATIONAL_FINALS_STATUSES);
  }

  return false;
}

function buildVisibilityWhere(input: {
  role: Role;
  userChapter?: string | null;
  status?: ApplicationStatus;
  selectedChapter?: string | null;
}): Prisma.ApplicationWhereInput {
  const statusFilter = input.status;
  const selectedChapter = input.selectedChapter?.trim();

  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") {
    const clauses: Prisma.ApplicationWhereInput[] = [];

    if (statusFilter) {
      clauses.push({ status: statusFilter });
    }

    if (selectedChapter) {
      clauses.push(buildChapterFilterWhere(selectedChapter));
    }

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { AND: clauses };
  }

  if (input.role === "CHAPTER_JUDGE") {
    if (statusFilter && !isInStatusSet(statusFilter, CHAPTER_ADJUDICATION_STATUSES)) {
      return { id: "__none__" };
    }
    if (!normalizeChapter(input.userChapter)) {
      return { id: "__none__" };
    }
    const chapterWhere = buildChapterFilterWhere(input.userChapter ?? "");
    return statusFilter
      ? { AND: [{ status: statusFilter }, chapterWhere] }
      : { AND: [{ status: { in: CHAPTER_ADJUDICATION_STATUSES } }, chapterWhere] };
  }

  if (input.role === "NATIONAL_JUDGE") {
    if (statusFilter && !isInStatusSet(statusFilter, NATIONAL_FINALS_STATUSES)) {
      return { id: "__none__" };
    }
    return statusFilter
      ? { status: statusFilter }
      : { status: { in: NATIONAL_FINALS_STATUSES } };
  }

  if (input.role === "CHAPTER_CHAIR") {
    const normalizedUserChapter = normalizeChapter(input.userChapter);
    const chapterWhere = normalizedUserChapter
      ? buildChapterFilterWhere(input.userChapter ?? "")
      : { id: "__none__" };

    if (!normalizedUserChapter) return { id: "__none__" };

    if (statusFilter) {
      return {
        AND: [
          { status: statusFilter },
          chapterWhere,
        ],
      };
    }

    return chapterWhere;
  }

  return { id: "__none__" };
}

export function canAdvanceApplicationStatusByRole(input: {
  role: Role;
  currentStatus: ApplicationStatus;
  nextStatus: ApplicationStatus;
  applicationChapter?: string | null;
  userChapter?: string | null;
}) {
  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") {
    return true;
  }

  if (input.role !== "CHAPTER_CHAIR") {
    return false;
  }

  if (!isChapterMatch(input.applicationChapter, input.userChapter)) {
    return false;
  }

  if (
    isInStatusSet(input.currentStatus, PENDING_APPROVAL_STATUSES) ||
    isInStatusSet(input.currentStatus, CORRECTION_REQUIRED_STATUSES)
  ) {
    return (
      input.nextStatus === "PENDING_APPROVAL" ||
      input.nextStatus === "CORRECTION_REQUIRED" ||
      input.nextStatus === "APPROVED_FOR_CHAPTER_ADJUDICATION" ||
      input.nextStatus === "DID_NOT_ADVANCE" ||
      input.nextStatus === "EXCLUDED" ||
      input.nextStatus === "WITHDRAWN"
    );
  }

  if (isInStatusSet(input.currentStatus, CHAPTER_ADJUDICATION_STATUSES)) {
    return (
      input.nextStatus === "PENDING_NATIONAL_ACCEPTANCE" ||
      input.nextStatus === "ALTERNATE" ||
      input.nextStatus === "DID_NOT_ADVANCE" ||
      input.nextStatus === "EXCLUDED" ||
      input.nextStatus === "WITHDRAWN"
    );
  }

  if (isInStatusSet(input.currentStatus, PENDING_NATIONAL_ACCEPTANCE_STATUSES)) {
    return (
      input.nextStatus === "ALTERNATE" ||
      input.nextStatus === "DID_NOT_ADVANCE" ||
      input.nextStatus === "EXCLUDED"
    );
  }

  return false;
}

const FORWARD_TO_NATIONALS_ELIGIBLE_STATUSES: ApplicationStatus[] = [
  ...CHAPTER_ADJUDICATION_STATUSES,
];

export function canForwardApplicationToNationalsByRole(input: {
  role: Role;
  currentStatus: ApplicationStatus;
  applicationChapter?: string | null;
  userChapter?: string | null;
}) {
  if (!FORWARD_TO_NATIONALS_ELIGIBLE_STATUSES.includes(input.currentStatus)) {
    return false;
  }

  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") {
    return true;
  }

  if (input.role === "CHAPTER_CHAIR") {
    return isChapterMatch(input.applicationChapter, input.userChapter);
  }

  return false;
}

export async function getPublicEventForApply(eventId: string) {
  return prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      organizationId: true,
      openAt: true,
      closeAt: true,
    },
  });
}

export async function listPublicApplicationChapters(organizationId: string) {
  const [applicationRows, userRows] = await Promise.all([
    prisma.application.findMany({
      where: {
        organizationId,
        chapter: {
          not: null,
        },
      },
      select: {
        chapter: true,
      },
      distinct: ["chapter"],
      orderBy: {
        chapter: "asc",
      },
    }),
    prisma.user.findMany({
      where: {
        organizationId,
        chapter: {
          not: null,
        },
      },
      select: {
        chapter: true,
      },
      distinct: ["chapter"],
      orderBy: {
        chapter: "asc",
      },
    }),
  ]);

  return Array.from(
    new Set(
      [...applicationRows, ...userRows]
        .map((row) => row.chapter?.trim() ?? "")
        .filter((chapter): chapter is string => chapter.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function getDivisionForSubmission(
  dateOfBirth: Date,
  options?: { competitionDate?: Date | null }
) {
  return resolveApplicationDivision({
    dateOfBirth,
    competitionDate: options?.competitionDate ?? null,
  });
}

export async function findPriorDivisionFirstPlace(input: {
  organizationId: string;
  currentEventId: string;
  email: string;
  dateOfBirth: Date;
  currentDivision?: ApplicationDivision | null;
}) {
  const division = input.currentDivision ?? getDivisionForSubmission(input.dateOfBirth);
  if (!division) return null;

  const historicalApplications = await prisma.application.findMany({
    where: {
      organizationId: input.organizationId,
      eventId: {
        not: input.currentEventId,
      },
      applicant: {
        email: input.email,
      },
      event: {
        status: {
          in: ["DECIDED", "CLOSED"],
        },
      },
    },
    select: {
      id: true,
      eventId: true,
      dateOfBirth: true,
      notes: true,
      event: {
        select: {
          id: true,
          name: true,
          openAt: true,
          closeAt: true,
          rounds: {
            select: {
              id: true,
              type: true,
              endAt: true,
              startAt: true,
            },
            orderBy: [
              { type: "desc" },
              { endAt: "desc" },
              { startAt: "desc" },
            ],
          },
        },
      },
    },
  });

  const eventsById = new Map<
    string,
    {
      name: string;
      rounds: Array<{
        id: string;
        type: RoundType;
        endAt: Date | null;
        startAt: Date | null;
      }>;
      applicationIds: Set<string>;
    }
  >();

  for (const application of historicalApplications) {
    const existing = eventsById.get(application.eventId) ?? {
      name: application.event.name,
      rounds: application.event.rounds,
      applicationIds: new Set<string>(),
    };
    existing.applicationIds.add(application.id);
    eventsById.set(application.eventId, existing);
  }

  for (const event of Array.from(eventsById.values())) {
    const finalRound =
      event.rounds.find((round) => round.type === "NATIONAL") ?? event.rounds[0];

    if (!finalRound) continue;

    const rankedResults = await getRankedResultsForRound(finalRound.id);
    const firstPlaceIds = new Set(
      rankedResults.filter((result) => result.rank === 1).map((result) => result.applicationId)
    );

    for (const application of historicalApplications) {
      if (!event.applicationIds.has(application.id)) continue;
      if (!firstPlaceIds.has(application.id)) continue;

      const previousDivision = resolveApplicationDivision({
        dateOfBirth: application.dateOfBirth,
        notes: application.notes,
        competitionDate: getCompetitionCutoffDate({
          openAt: application.event.openAt,
          closeAt: application.event.closeAt,
        }),
      });

      if (previousDivision === division) {
        return {
          division,
          eventName: event.name,
        };
      }
    }
  }

  return null;
}

export async function createPublicApplication(data: {
  eventId: string;
  organizationId: string;
  name: string;
  email: string;
  chapter: string;
  dateOfBirth: Date;
  gender?: string | null;
  voicePart: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  schoolName?: string | null;
  schoolCity?: string | null;
  schoolState?: string | null;
  highSchoolName?: string | null;
  collegeName?: string | null;
  major?: string | null;
  video1Title: string;
  video1Url: string;
  video2Title: string;
  video2Url: string;
  video3Title: string;
  video3Url: string;
  youtubePlaylist?: string | null;
  headshotUrl?: string | null;
  bio: string;
  careerPlans: string;
  scholarshipUse: string;
  parentName?: string | null;
  parentEmail?: string | null;
  citizenshipStatus?: string | null;
  citizenshipDocumentUrl?: string | null;
  resourceUrls?: string[];
  mediaRelease: boolean;
  certifyDateOfBirth: boolean;
  hasPriorFirstPrize: boolean;
  priorFirstPrizeDivision?: string | null;
  acceptPrivacyPolicy: boolean;
  acceptTerms: boolean;
}) {
  // Find or create applicant user by email
  let user = await prisma.user.findUnique({
    where: { email: data.email },
    select: { id: true },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(randomUUID(), 10);
    user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: Role.APPLICANT,
        organizationId: data.organizationId,
        passwordHash,
      },
      select: { id: true },
    });
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
      },
    });
  }

  return prisma.application.create({
    data: {
      organizationId: data.organizationId,
      eventId: data.eventId,
      applicantId: user.id,
      status: ApplicationStatus.PENDING_APPROVAL,
      chapter: data.chapter,
      dateOfBirth: data.dateOfBirth,
      gender: data.gender ?? null,
      phone: data.phone,
      address: data.address,
      city: data.city,
      state: data.state,
      zip: data.zip,
      schoolName: data.schoolName ?? null,
      schoolCity: data.schoolCity ?? null,
      schoolState: data.schoolState ?? null,
      highSchoolName: data.highSchoolName ?? null,
      collegeName: data.collegeName ?? null,
      major: data.major ?? null,
      repertoire: null,
      video1Title: data.video1Title,
      video1Url: data.video1Url,
      video2Title: data.video2Title,
      video2Url: data.video2Url,
      video3Title: data.video3Title,
      video3Url: data.video3Url,
      youtubePlaylist: data.youtubePlaylist ?? null,
      headshot: data.headshotUrl ?? null,
      bio: data.bio,
      careerPlans: data.careerPlans,
      scholarshipUse: data.scholarshipUse,
      parentName: data.parentName ?? null,
      parentEmail: data.parentEmail ?? null,
      notes: buildApplicationMetadata({
        voicePart: data.voicePart,
        videoUrls: [data.video1Url, data.video2Url, data.video3Url],
        citizenshipStatus: data.citizenshipStatus ?? null,
        citizenshipDocumentUrl: data.citizenshipDocumentUrl ?? null,
        resourceUrls: data.resourceUrls ?? [],
        intakeHeadshotUrl: data.headshotUrl ?? null,
        mediaReleaseAccepted: data.mediaRelease,
        dateOfBirthCertified: data.certifyDateOfBirth,
        hasPriorFirstPrize: data.hasPriorFirstPrize,
        priorFirstPrizeDivision: data.priorFirstPrizeDivision ?? null,
        privacyPolicyAccepted: data.acceptPrivacyPolicy,
        submissionTermsAccepted: data.acceptTerms,
      }),
    },
  });
}

export async function hasExistingApplication(
  eventId: string,
  email: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return false;

  const count = await prisma.application.count({
    where: { eventId, applicantId: user.id },
  });
  return count > 0;
}

export async function listApplicationsByOrg(
  organizationId: string,
  status?: ApplicationStatus,
  visibility?: {
    role: Role;
    userChapter?: string | null;
    selectedChapter?: string | null;
  }
) {
  const visibilityWhere = visibility
    ? buildVisibilityWhere({
        role: visibility.role,
        userChapter: visibility.userChapter,
        status,
        selectedChapter: visibility.selectedChapter,
      })
    : status
      ? { status }
      : {};

  return prisma.application.findMany({
    where: {
      organizationId,
      ...visibilityWhere,
    },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      submittedAt: "desc",
    },
  });
}

export async function listApplicationChaptersByOrg(
  organizationId: string,
  visibility?: {
    role: Role;
    userChapter?: string | null;
  }
) {
  const visibilityWhere = visibility
    ? buildVisibilityWhere({
        role: visibility.role,
        userChapter: visibility.userChapter,
      })
    : {};

  const rows = await prisma.application.findMany({
    where: {
      organizationId,
      ...visibilityWhere,
      chapter: {
        not: null,
      },
    },
    select: {
      chapter: true,
    },
    distinct: ["chapter"],
    orderBy: {
      chapter: "asc",
    },
  });

  return rows
    .map((row) => row.chapter?.trim() ?? "")
    .filter((chapter): chapter is string => chapter.length > 0);
}

export async function getApplicationById(
  id: string,
  organizationId: string,
  visibility?: {
    role: Role;
    userChapter?: string | null;
  }
) {
  const application = await prisma.application.findFirst({
    where: { id, organizationId },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
          status: true,
          openAt: true,
          closeAt: true,
        },
      },
      scores: {
        include: {
          criteria: {
            select: {
              id: true,
              name: true,
              order: true,
              rubric: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          judge: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: [{ criteria: { order: "asc" } }, { judge: { name: "asc" } }],
      },
    },
  });

  if (!application) return null;
  if (!visibility) return application;

  if (
    !canViewApplicationByRole({
      role: visibility.role,
      status: application.status,
      applicationChapter: application.chapter,
      userChapter: visibility.userChapter,
    })
  ) {
    return null;
  }

  return application;
}

export async function getPublicApplicationById(id: string) {
  return prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      notes: true,
      headshot: true,
      applicant: {
        select: { name: true, email: true },
      },
      event: {
        select: { name: true },
      },
    },
  });
}

export async function getApplicationDocumentRefsById(id: string) {
  return prisma.application.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      headshot: true,
      notes: true,
    },
  });
}

export async function advanceApplicationStatus(
  id: string,
  nextStatus: ApplicationStatus,
  organizationId: string
) {
  const existing = await prisma.application.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });

  if (!existing) return null;

  return prisma.application.update({
    where: { id: existing.id },
    data: { status: nextStatus },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      event: {
        select: { id: true, name: true },
      },
    },
  });
}

export async function advanceApplicationStatusWithPermissions(input: {
  id: string;
  nextStatus: ApplicationStatus;
  organizationId: string;
  actorUserId: string;
  actorRole: Role;
  actorChapter?: string | null;
  reason?: string | null;
}) {
  const existing = await prisma.application.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
    select: { id: true, status: true, chapter: true, notes: true, eventId: true },
  });

  if (!existing) {
    return { reason: "NOT_FOUND" as const };
  }

  const allowed = canAdvanceApplicationStatusByRole({
    role: input.actorRole,
    currentStatus: existing.status,
    nextStatus: input.nextStatus,
    applicationChapter: existing.chapter,
    userChapter: input.actorChapter,
  });

  if (!allowed) {
    return { reason: "FORBIDDEN" as const };
  }

  const canAdvanceWithoutCitizenship = NON_FORWARD_STATUSES.includes(input.nextStatus);
  if (!canAdvanceWithoutCitizenship && !isCitizenshipVerifiedInNotes(existing.notes)) {
    return { reason: "CITIZENSHIP_NOT_VERIFIED" as const };
  }

  const normalizedReason = input.reason?.trim() || null;
  if (input.nextStatus === "APPROVED_FOR_NATIONAL_ADJUDICATION") {
    const unresolvedChapterApplications = await prisma.application.count({
      where: {
        organizationId: input.organizationId,
        eventId: existing.eventId,
        status: {
          in: [
            "PENDING_APPROVAL",
            "CORRECTION_REQUIRED",
            "APPROVED_FOR_CHAPTER_ADJUDICATION",
            "SUBMITTED_PENDING_APPROVAL",
            "CHAPTER_ADJUDICATION",
            "SUBMITTED",
            "CHAPTER_REVIEW",
          ],
        },
      },
    });

    if (
      unresolvedChapterApplications > 0 &&
      !(normalizedReason && (input.actorRole === "ADMIN" || input.actorRole === "NATIONAL_CHAIR"))
    ) {
      return { reason: "CHAPTERS_UNRESOLVED" as const };
    }
  }

  const notesObject = parseNotesObject(existing.notes);
  const auditHistory = Array.isArray(notesObject.auditHistory)
    ? [...notesObject.auditHistory]
    : [];
  auditHistory.push({
    type: "STATUS_UPDATE",
    at: new Date().toISOString(),
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    fromStatus: existing.status,
    toStatus: input.nextStatus,
    reason: normalizedReason,
    override:
      input.actorRole === "ADMIN" || input.actorRole === "NATIONAL_CHAIR"
        ? true
        : false,
    chaptersResolvedOverride:
      input.nextStatus === "APPROVED_FOR_NATIONAL_ADJUDICATION" &&
      Boolean(normalizedReason),
  });
  notesObject.auditHistory = auditHistory;

  const updated = await prisma.application.update({
    where: { id: existing.id },
    data: {
      status: input.nextStatus,
      notes: JSON.stringify(notesObject),
    },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      event: {
        select: { id: true, name: true },
      },
    },
  });

  if (!updated) {
    return { reason: "NOT_FOUND" as const };
  }

  return { reason: "OK" as const, updated };
}

type ForwardToNationalsBypassInput = {
  id: string;
  organizationId: string;
  actorUserId: string;
  actorRole: Role;
  actorChapter?: string | null;
  reason?: string | null;
};

export async function forwardApplicationToNationalsWithBypass(
  input: ForwardToNationalsBypassInput
) {
  const existing = await prisma.application.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
    select: { id: true, status: true, chapter: true, notes: true },
  });

  if (!existing) {
    return { reason: "NOT_FOUND" as const };
  }

  const allowed = canForwardApplicationToNationalsByRole({
    role: input.actorRole,
    currentStatus: existing.status,
    applicationChapter: existing.chapter,
    userChapter: input.actorChapter,
  });

  if (!allowed) {
    return { reason: "FORBIDDEN" as const };
  }

  if (!isCitizenshipVerifiedInNotes(existing.notes)) {
    return { reason: "CITIZENSHIP_NOT_VERIFIED" as const };
  }

  const notesObject = parseNotesObject(existing.notes);
  const timestamp = new Date().toISOString();
  const normalizedReason = input.reason?.trim() || null;
  const auditHistory = Array.isArray(notesObject.auditHistory)
    ? [...notesObject.auditHistory]
    : [];

  auditHistory.push({
    type: "FORWARDED_TO_NATIONALS_BYPASS_CHAPTER",
    at: timestamp,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    fromStatus: existing.status,
    toStatus: "PENDING_NATIONAL_ACCEPTANCE",
    reason: normalizedReason,
  });

  notesObject.auditHistory = auditHistory;
  notesObject.chapterBypassForward = {
    forwarded: true,
    at: timestamp,
    actorUserId: input.actorUserId,
    actorRole: input.actorRole,
    reason: normalizedReason,
  };

  const updated = await prisma.application.update({
    where: { id: existing.id },
    data: {
      status: "PENDING_NATIONAL_ACCEPTANCE",
      notes: JSON.stringify(notesObject),
    },
    include: {
      applicant: {
        select: { id: true, name: true, email: true },
      },
      event: {
        select: { id: true, name: true },
      },
    },
  });

  return { reason: "OK" as const, updated };
}

type ChapterCloseoutInput = {
  organizationId: string;
  eventId: string;
  roundId: string;
  actorUserId: string;
  actorRole: Role;
  actorChapter?: string | null;
  chapter?: string | null;
  winnerApplicationIds: string[];
  alternateApplicationId?: string | null;
};

type ChapterCloseoutPreview =
  | { reason: "NOT_FOUND" | "NOT_CHAPTER_ROUND" | "ROUND_CERTIFIED" | "ADVANCEMENT_SLOTS_NOT_CONFIGURED" | "CHAPTER_REQUIRED" | "FORBIDDEN" | "INVALID_WINNER_COUNT" | "INVALID_SELECTION" | "UNRESOLVED_APPLICATIONS" | "INCOMPLETE_RESULTS" }
  | {
      reason: "OK";
      chapter: string;
      advancementSlots: number;
      winners: Array<{ applicationId: string; applicantName: string }>;
      suggestedAlternate: { applicationId: string; applicantName: string } | null;
      didNotAdvanceCount: number;
    };

async function buildChapterCloseoutPreview(
  input: ChapterCloseoutInput
): Promise<ChapterCloseoutPreview> {
  const round = await prisma.round.findFirst({
    where: {
      id: input.roundId,
      eventId: input.eventId,
      organizationId: input.organizationId,
    },
    select: {
      id: true,
      type: true,
      advancementSlots: true,
      eventId: true,
    },
  });

  if (!round) return { reason: "NOT_FOUND" };
  if (round.type !== "CHAPTER") return { reason: "NOT_CHAPTER_ROUND" };

  const certification = await prisma.roundCertification.findUnique({
    where: { roundId: round.id },
    select: { id: true },
  });
  if (certification) return { reason: "ROUND_CERTIFIED" };

  const advancementSlots = round.advancementSlots ?? 0;
  if (advancementSlots < 1) {
    return { reason: "ADVANCEMENT_SLOTS_NOT_CONFIGURED" };
  }

  const chapter =
    input.actorRole === "CHAPTER_CHAIR"
      ? input.actorChapter?.trim() ?? ""
      : input.chapter?.trim() ?? "";

  if (!chapter) return { reason: "CHAPTER_REQUIRED" };
  if (
    input.actorRole === "CHAPTER_CHAIR" &&
    !isChapterMatch(chapter, input.actorChapter)
  ) {
    return { reason: "FORBIDDEN" };
  }

  const unresolvedChapterApplications = await prisma.application.count({
    where: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      AND: [buildChapterFilterWhere(chapter)],
      status: {
        in: [...PENDING_APPROVAL_STATUSES, ...CORRECTION_REQUIRED_STATUSES],
      },
    },
  });

  if (unresolvedChapterApplications > 0) {
    return { reason: "UNRESOLVED_APPLICATIONS" };
  }

  const rankedResults = await getRankedResultsForRound(round.id, {
    chapterFilter: chapter,
  });

  if (rankedResults.length === 0) {
    return { reason: "INCOMPLETE_RESULTS" };
  }

  const chapterApplications = await prisma.application.findMany({
    where: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      AND: [buildChapterFilterWhere(chapter)],
      status: {
        in: [
          ...CHAPTER_ADJUDICATION_STATUSES,
          ...PENDING_NATIONAL_ACCEPTANCE_STATUSES,
          "ALTERNATE",
          "DID_NOT_ADVANCE",
        ],
      },
    },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const rankedIds = new Set(rankedResults.map((result) => result.applicationId));
  const unrankedChapterApps = chapterApplications.filter(
    (application) =>
      CHAPTER_ADJUDICATION_STATUSES.includes(application.status) &&
      !rankedIds.has(application.id)
  );
  if (unrankedChapterApps.length > 0) {
    return { reason: "INCOMPLETE_RESULTS" };
  }

  const uniqueWinnerIds = Array.from(
    new Set(input.winnerApplicationIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueWinnerIds.length !== advancementSlots) {
    return { reason: "INVALID_WINNER_COUNT" };
  }

  const applicationById = new Map(
    chapterApplications.map((application) => [application.id, application])
  );

  for (const winnerId of uniqueWinnerIds) {
    if (!applicationById.has(winnerId)) {
      return { reason: "INVALID_SELECTION" };
    }
  }

  if (
    input.alternateApplicationId &&
    (!applicationById.has(input.alternateApplicationId) ||
      uniqueWinnerIds.includes(input.alternateApplicationId))
  ) {
    return { reason: "INVALID_SELECTION" };
  }

  const winners = uniqueWinnerIds
    .map((applicationId) => {
      const application = applicationById.get(applicationId);
      return application
        ? {
            applicationId,
            applicantName: application.applicant.name,
          }
        : null;
    })
    .filter(
      (entry): entry is { applicationId: string; applicantName: string } => entry !== null
    );

  const rankedAlternate = rankedResults.find(
    (result) => !uniqueWinnerIds.includes(result.applicationId)
  );
  const computedAlternate =
    input.alternateApplicationId && applicationById.has(input.alternateApplicationId)
      ? {
          applicationId: input.alternateApplicationId,
          applicantName: applicationById.get(input.alternateApplicationId)!.applicant.name,
        }
      : rankedAlternate
          ? {
              applicationId: rankedAlternate.applicationId,
              applicantName: rankedAlternate.applicantName,
            }
          : null;

  const didNotAdvanceCount = chapterApplications.filter(
    (application) =>
      !uniqueWinnerIds.includes(application.id) &&
      application.id !== computedAlternate?.applicationId
  ).length;

  return {
    reason: "OK",
    chapter,
    advancementSlots,
    winners,
    suggestedAlternate: computedAlternate,
    didNotAdvanceCount,
  };
}

export async function closeOutChapterAdjudication(
  input: ChapterCloseoutInput
) {
  const preview = await buildChapterCloseoutPreview(input);
  if (preview.reason !== "OK") return preview;

  const chapterApplications = await prisma.application.findMany({
    where: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      AND: [buildChapterFilterWhere(preview.chapter)],
      status: {
        in: [
          ...CHAPTER_ADJUDICATION_STATUSES,
          ...PENDING_NATIONAL_ACCEPTANCE_STATUSES,
          "ALTERNATE",
          "DID_NOT_ADVANCE",
        ],
      },
    },
    include: {
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const winnerIds = new Set(preview.winners.map((winner) => winner.applicationId));
  const alternateId = preview.suggestedAlternate?.applicationId ?? null;
  const timestamp = new Date().toISOString();

  const updatedApplications = await prisma.$transaction(async (tx) => {
    const updates = [];

    for (const application of chapterApplications) {
      const nextStatus: ApplicationStatus = winnerIds.has(application.id)
        ? "PENDING_NATIONAL_ACCEPTANCE"
        : application.id === alternateId
          ? "ALTERNATE"
          : "DID_NOT_ADVANCE";

      if (application.status === nextStatus) {
        continue;
      }

      const notesObject = parseNotesObject(application.notes);
      const auditHistory = Array.isArray(notesObject.auditHistory)
        ? [...notesObject.auditHistory]
        : [];
      auditHistory.push({
        type: "STATUS_UPDATE",
        at: timestamp,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        fromStatus: application.status,
        toStatus: nextStatus,
        reason: `Chapter closeout for ${preview.chapter}.`,
        chapterCloseout: true,
      });
      notesObject.auditHistory = auditHistory;

      const updated = await tx.application.update({
        where: { id: application.id },
        data: {
          status: nextStatus,
          notes: JSON.stringify(notesObject),
        },
        include: {
          applicant: {
            select: { id: true, name: true, email: true },
          },
          event: {
            select: { id: true, name: true },
          },
        },
      });
      updates.push(updated);
    }

    return updates;
  });

  return {
    reason: "OK" as const,
    chapter: preview.chapter,
    winners: preview.winners,
    alternate: preview.suggestedAlternate,
    updatedApplications,
  };
}

export async function deleteApplicationById(id: string, organizationId: string) {
  const application = await prisma.application.findFirst({
    where: { id, organizationId },
    select: { id: true, applicantId: true },
  });

  if (!application) return null;

  const result = await prisma.$transaction(async (tx) => {
    const deletedScores = await tx.score.deleteMany({
      where: { applicationId: application.id, organizationId },
    });

    await tx.application.delete({
      where: { id: application.id },
    });

    const remainingApplications = await tx.application.count({
      where: { applicantId: application.applicantId, organizationId },
    });

    let deletedApplicant = false;
    if (remainingApplications === 0) {
      const applicant = await tx.user.findFirst({
        where: {
          id: application.applicantId,
          organizationId,
          role: Role.APPLICANT,
        },
        select: { id: true },
      });

      if (applicant) {
        await tx.user.delete({ where: { id: applicant.id } });
        deletedApplicant = true;
      }
    }

    return {
      id: application.id,
      deletedScores: deletedScores.count,
      deletedApplicant,
    };
  });

  return result;
}

export async function deleteApplicationsByIds(ids: string[], organizationId: string) {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) {
    return {
      deletedApplications: 0,
      deletedScores: 0,
      deletedApplicants: 0,
      skipped: 0,
    };
  }

  const existing = await prisma.application.findMany({
    where: {
      organizationId,
      id: { in: uniqueIds },
    },
    select: {
      id: true,
      applicantId: true,
    },
  });

  if (existing.length === 0) {
    return {
      deletedApplications: 0,
      deletedScores: 0,
      deletedApplicants: 0,
      skipped: uniqueIds.length,
    };
  }

  const existingIds = existing.map((application) => application.id);
  const applicantIds = Array.from(
    new Set(existing.map((application) => application.applicantId))
  );

  const result = await prisma.$transaction(async (tx) => {
    const deletedScores = await tx.score.deleteMany({
      where: {
        organizationId,
        applicationId: { in: existingIds },
      },
    });

    const deletedApplications = await tx.application.deleteMany({
      where: {
        organizationId,
        id: { in: existingIds },
      },
    });

    const remainingCounts = await tx.application.groupBy({
      by: ["applicantId"],
      where: {
        organizationId,
        applicantId: { in: applicantIds },
      },
      _count: { applicantId: true },
    });

    const applicantsWithRemainingApps = new Set(
      remainingCounts
        .filter((row) => row._count.applicantId > 0)
        .map((row) => row.applicantId)
    );

    const orphanApplicantIds = applicantIds.filter(
      (applicantId) => !applicantsWithRemainingApps.has(applicantId)
    );

    let deletedApplicants = 0;
    if (orphanApplicantIds.length > 0) {
      const deletedApplicantRows = await tx.user.deleteMany({
        where: {
          organizationId,
          role: Role.APPLICANT,
          id: { in: orphanApplicantIds },
        },
      });
      deletedApplicants = deletedApplicantRows.count;
    }

    return {
      deletedScores: deletedScores.count,
      deletedApplications: deletedApplications.count,
      deletedApplicants,
    };
  });

  return {
    ...result,
    skipped: uniqueIds.length - existingIds.length,
  };
}

type ApplicationProfileUpdateInput = {
  id: string;
  organizationId: string;
  applicantName?: string | null;
  applicantEmail?: string | null;
  chapter?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  schoolName?: string | null;
  schoolCity?: string | null;
  schoolState?: string | null;
  highSchoolName?: string | null;
  collegeName?: string | null;
  major?: string | null;
  bio?: string | null;
  careerPlans?: string | null;
  scholarshipUse?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  headshotUrl?: string | null;
  voicePart?: string | null;
  citizenshipStatus?: string | null;
  citizenshipDocumentUrl?: string | null;
  citizenshipVerified?: boolean | null;
  repertoire?: string | null;
  adminNote?: string | null;
  video1Title?: string | null;
  video1Url?: string | null;
  video2Title?: string | null;
  video2Url?: string | null;
  video3Title?: string | null;
  video3Url?: string | null;
  actor?: string | null;
  actorRole?: Role | null;
  chapterChangeNote?: string | null;
};

function parseNotesObject(notes: string | null): Record<string, unknown> {
  if (!notes || notes.trim().length === 0) return {};
  try {
    const parsed = JSON.parse(notes) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return { voicePart: notes };
  }
  return {};
}

function isCitizenshipVerifiedInNotes(notes: string | null) {
  const notesObject = parseNotesObject(notes);
  const verification = notesObject.citizenshipVerification;
  if (!verification || typeof verification !== "object") return false;
  return (verification as { verified?: unknown }).verified === true;
}

export async function updateApplicationProfile(input: ApplicationProfileUpdateInput) {
  const existing = await prisma.application.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
    select: { id: true, chapter: true, notes: true, applicantId: true },
  });

  if (!existing) return null;

  const notesObject = parseNotesObject(existing.notes);
  const hasChapterUpdate = typeof input.chapter !== "undefined";
  const nextChapter = hasChapterUpdate ? input.chapter?.trim() ?? null : undefined;
  const hasAdminNoteUpdate = typeof input.adminNote !== "undefined";
  const nextAdminNote = hasAdminNoteUpdate ? input.adminNote?.trim() ?? null : undefined;
  const hasApplicantNameUpdate = typeof input.applicantName !== "undefined";
  const nextApplicantName = hasApplicantNameUpdate
    ? input.applicantName?.trim() || undefined
    : undefined;
  const hasApplicantEmailUpdate = typeof input.applicantEmail !== "undefined";
  const nextApplicantEmail = hasApplicantEmailUpdate
    ? input.applicantEmail?.trim() || undefined
    : undefined;
  const actor = input.actor?.trim() || "admin";
  const chapterChangeNote = input.chapterChangeNote?.trim() || "";
  const nextVoicePart =
    typeof input.voicePart !== "undefined" ? input.voicePart?.trim() ?? null : undefined;
  const nextCitizenshipStatus =
    typeof input.citizenshipStatus !== "undefined"
      ? input.citizenshipStatus?.trim() ?? null
      : undefined;
  const nextCitizenshipDocumentUrl =
    typeof input.citizenshipDocumentUrl !== "undefined"
      ? input.citizenshipDocumentUrl?.trim() ?? null
      : undefined;

  if (hasAdminNoteUpdate) {
    if (nextAdminNote) {
      notesObject.adminProfileNote = nextAdminNote;
    } else {
      delete notesObject.adminProfileNote;
    }
  }

  if (
    hasChapterUpdate &&
    typeof nextChapter === "string" &&
    nextChapter !== (existing.chapter ?? null)
  ) {
    const chapterHistory = Array.isArray(notesObject.chapterAssignmentHistory)
      ? [...notesObject.chapterAssignmentHistory]
      : [];
    chapterHistory.push({
      at: new Date().toISOString(),
      by: actor,
      from: existing.chapter ?? "No chapter",
      to: nextChapter,
      note:
        typeof nextAdminNote === "string" && nextAdminNote.trim().length > 0
          ? nextAdminNote
          : chapterChangeNote,
    });
    notesObject.chapterAssignmentHistory = chapterHistory;
  }

  if (typeof input.citizenshipVerified === "boolean") {
    notesObject.citizenshipVerification = {
      verified: input.citizenshipVerified,
      status: input.citizenshipVerified ? "VERIFIED" : "UNVERIFIED",
      updatedAt: new Date().toISOString(),
      updatedBy: actor,
      updatedByRole: input.actorRole ?? null,
    };
  }

  if (typeof nextVoicePart !== "undefined") {
    if (nextVoicePart) {
      notesObject.voicePart = nextVoicePart;
    } else {
      delete notesObject.voicePart;
    }
  }

  if (typeof nextCitizenshipStatus !== "undefined") {
    if (nextCitizenshipStatus) {
      notesObject.citizenshipStatus = nextCitizenshipStatus;
    } else {
      delete notesObject.citizenshipStatus;
    }
  }

  if (typeof nextCitizenshipDocumentUrl !== "undefined") {
    if (nextCitizenshipDocumentUrl) {
      notesObject.citizenshipDocumentUrl = nextCitizenshipDocumentUrl;
    } else {
      delete notesObject.citizenshipDocumentUrl;
    }
  }

  return prisma.$transaction(async (tx) => {
    if (hasApplicantNameUpdate || hasApplicantEmailUpdate) {
      await tx.user.update({
        where: { id: existing.applicantId },
        data: {
          name: typeof nextApplicantName !== "undefined" ? nextApplicantName : undefined,
          email: typeof nextApplicantEmail !== "undefined" ? nextApplicantEmail : undefined,
        },
      });
    }

    return tx.application.update({
      where: { id: existing.id },
      data: {
        chapter: hasChapterUpdate ? nextChapter : undefined,
        dateOfBirth: typeof input.dateOfBirth !== "undefined" ? input.dateOfBirth : undefined,
        gender: typeof input.gender !== "undefined" ? input.gender?.trim() || null : undefined,
        phone: typeof input.phone !== "undefined" ? input.phone?.trim() || null : undefined,
        address: typeof input.address !== "undefined" ? input.address?.trim() || null : undefined,
        city: typeof input.city !== "undefined" ? input.city?.trim() || null : undefined,
        state: typeof input.state !== "undefined" ? input.state?.trim() || null : undefined,
        zip: typeof input.zip !== "undefined" ? input.zip?.trim() || null : undefined,
        schoolName:
          typeof input.schoolName !== "undefined" ? input.schoolName?.trim() || null : undefined,
        schoolCity:
          typeof input.schoolCity !== "undefined" ? input.schoolCity?.trim() || null : undefined,
        schoolState:
          typeof input.schoolState !== "undefined" ? input.schoolState?.trim() || null : undefined,
        highSchoolName:
          typeof input.highSchoolName !== "undefined"
            ? input.highSchoolName?.trim() || null
            : undefined,
        collegeName:
          typeof input.collegeName !== "undefined" ? input.collegeName?.trim() || null : undefined,
        major: typeof input.major !== "undefined" ? input.major?.trim() || null : undefined,
        bio: typeof input.bio !== "undefined" ? input.bio?.trim() || null : undefined,
        careerPlans:
          typeof input.careerPlans !== "undefined" ? input.careerPlans?.trim() || null : undefined,
        scholarshipUse:
          typeof input.scholarshipUse !== "undefined"
            ? input.scholarshipUse?.trim() || null
            : undefined,
        parentName:
          typeof input.parentName !== "undefined" ? input.parentName?.trim() || null : undefined,
        parentEmail:
          typeof input.parentEmail !== "undefined" ? input.parentEmail?.trim() || null : undefined,
        headshot:
          typeof input.headshotUrl !== "undefined" ? input.headshotUrl?.trim() || null : undefined,
        repertoire:
          typeof input.repertoire !== "undefined" ? input.repertoire?.trim() || null : undefined,
        notes: JSON.stringify(notesObject),
        video1Title: input.video1Title?.trim() || null,
        video1Url: input.video1Url?.trim() || null,
        video2Title: input.video2Title?.trim() || null,
        video2Url: input.video2Url?.trim() || null,
        video3Title: input.video3Title?.trim() || null,
        video3Url: input.video3Url?.trim() || null,
      },
      include: {
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        event: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        scores: {
          include: {
            criteria: {
              select: {
                id: true,
                name: true,
                order: true,
                rubric: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            judge: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: [{ criteria: { order: "asc" } }, { judge: { name: "asc" } }],
        },
      },
    });
  });
}
