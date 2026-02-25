import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { buildApplicationMetadata } from "@/lib/application-metadata";

export const PENDING_APPROVAL_STATUSES: ApplicationStatus[] = [
  "SUBMITTED_PENDING_APPROVAL",
  "SUBMITTED",
];

export const CHAPTER_ADJUDICATION_STATUSES: ApplicationStatus[] = [
  "CHAPTER_ADJUDICATION",
  "CHAPTER_REVIEW",
];

export const NATIONAL_FINALS_STATUSES: ApplicationStatus[] = [
  "NATIONAL_FINALS",
  "NATIONAL_REVIEW",
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
  return app.length > 0 && user.length > 0 && app === user;
}

function isInStatusSet(status: ApplicationStatus, statuses: ApplicationStatus[]) {
  return statuses.includes(status);
}

export function getAllowedApplicationStatusesForRole(role: Role): ApplicationStatus[] {
  if (role === "ADMIN" || role === "NATIONAL_CHAIR") {
    return [
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
    return [...PENDING_APPROVAL_STATUSES, ...CHAPTER_ADJUDICATION_STATUSES];
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
    if (isInStatusSet(input.status, CHAPTER_ADJUDICATION_STATUSES)) return true;
    if (isInStatusSet(input.status, PENDING_APPROVAL_STATUSES)) {
      return isChapterMatch(input.applicationChapter, input.userChapter);
    }
    return false;
  }

  if (input.role === "CHAPTER_JUDGE") {
    return isInStatusSet(input.status, CHAPTER_ADJUDICATION_STATUSES);
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
}): Prisma.ApplicationWhereInput {
  const statusFilter = input.status;

  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") {
    return statusFilter ? { status: statusFilter } : {};
  }

  if (input.role === "CHAPTER_JUDGE") {
    if (statusFilter && !isInStatusSet(statusFilter, CHAPTER_ADJUDICATION_STATUSES)) {
      return { id: "__none__" };
    }
    return statusFilter
      ? { status: statusFilter }
      : { status: { in: CHAPTER_ADJUDICATION_STATUSES } };
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
    const userChapterKey = chapterMatchKey(input.userChapter);
    const canUseContains = userChapterKey.length >= 3;

    const chapterPendingWhere: Prisma.ApplicationWhereInput =
      normalizedUserChapter && canUseContains
        ? {
            OR: [
              {
                chapter: {
                  equals: normalizedUserChapter,
                  mode: "insensitive",
                },
              },
              {
                chapter: {
                  contains: userChapterKey,
                  mode: "insensitive",
                },
              },
            ],
          }
        : normalizedUserChapter
          ? {
              chapter: {
                equals: normalizedUserChapter,
                mode: "insensitive",
              },
            }
          : { id: "__none__" };

    if (statusFilter) {
      if (isInStatusSet(statusFilter, CHAPTER_ADJUDICATION_STATUSES)) {
        return { status: statusFilter };
      }
      if (isInStatusSet(statusFilter, PENDING_APPROVAL_STATUSES)) {
        if (!normalizedUserChapter) return { id: "__none__" };
        return { status: statusFilter, ...chapterPendingWhere };
      }
      return { id: "__none__" };
    }

    const clauses: Prisma.ApplicationWhereInput[] = [
      { status: { in: CHAPTER_ADJUDICATION_STATUSES } },
    ];

    if (normalizedUserChapter) {
      clauses.push({
        status: { in: PENDING_APPROVAL_STATUSES },
        ...chapterPendingWhere,
      });
    }

    return { OR: clauses };
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
  const fromPending = isInStatusSet(input.currentStatus, PENDING_APPROVAL_STATUSES);
  if (!fromPending) {
    return input.role === "ADMIN" || input.role === "NATIONAL_CHAIR";
  }

  const isPendingApprovalAction =
    input.nextStatus === "CHAPTER_ADJUDICATION" ||
    input.nextStatus === "CHAPTER_REJECTED" ||
    input.nextStatus === "SUBMITTED_PENDING_APPROVAL";

  if (!isPendingApprovalAction) return false;
  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") return true;
  if (input.role === "CHAPTER_CHAIR") {
    return isChapterMatch(input.applicationChapter, input.userChapter);
  }
  return false;
}

const FORWARD_TO_NATIONALS_ELIGIBLE_STATUSES: ApplicationStatus[] = [
  ...PENDING_APPROVAL_STATUSES,
  ...CHAPTER_ADJUDICATION_STATUSES,
  "CHAPTER_APPROVED",
];

export function canForwardApplicationToNationalsByRole(input: {
  role: Role;
  currentStatus: ApplicationStatus;
  applicationChapter?: string | null;
  userChapter?: string | null;
}) {
  if (
    input.role !== "ADMIN" &&
    input.role !== "NATIONAL_CHAIR" &&
    input.role !== "CHAPTER_CHAIR"
  ) {
    return false;
  }

  if (!FORWARD_TO_NATIONALS_ELIGIBLE_STATUSES.includes(input.currentStatus)) {
    return false;
  }

  if (input.role === "ADMIN" || input.role === "NATIONAL_CHAIR") {
    return true;
  }

  return canViewApplicationByRole({
    role: input.role,
    status: input.currentStatus,
    applicationChapter: input.applicationChapter,
    userChapter: input.userChapter,
  });
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
    },
  });
}

export async function createPublicApplication(data: {
  eventId: string;
  organizationId: string;
  name: string;
  email: string;
  voicePart: string;
  repertoire: string;
  videoUrls?: string[];
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
  }

  return prisma.application.create({
    data: {
      organizationId: data.organizationId,
      eventId: data.eventId,
      applicantId: user.id,
      status: ApplicationStatus.SUBMITTED_PENDING_APPROVAL,
      repertoire: data.repertoire,
      notes: buildApplicationMetadata({
        voicePart: data.voicePart,
        videoUrls: data.videoUrls ?? [],
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
  }
) {
  const visibilityWhere = visibility
    ? buildVisibilityWhere({
        role: visibility.role,
        userChapter: visibility.userChapter,
        status,
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
  actorRole: Role;
  actorChapter?: string | null;
}) {
  const existing = await prisma.application.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
    select: { id: true, status: true, chapter: true },
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

  const updated = await advanceApplicationStatus(
    existing.id,
    input.nextStatus,
    input.organizationId
  );

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
    toStatus: "NATIONAL_FINALS",
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
      status: "NATIONAL_FINALS",
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
  chapter?: string | null;
  adminNote?: string | null;
  video1Title?: string | null;
  video1Url?: string | null;
  video2Title?: string | null;
  video2Url?: string | null;
  video3Title?: string | null;
  video3Url?: string | null;
  actor?: string | null;
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

export async function updateApplicationProfile(input: ApplicationProfileUpdateInput) {
  const existing = await prisma.application.findFirst({
    where: { id: input.id, organizationId: input.organizationId },
    select: { id: true, chapter: true, notes: true, applicantId: true },
  });

  if (!existing) return null;

  const notesObject = parseNotesObject(existing.notes);
  const nextChapter = input.chapter?.trim() ?? null;
  const nextAdminNote = input.adminNote?.trim() ?? null;
  const nextApplicantName = input.applicantName?.trim() ?? null;
  const actor = input.actor?.trim() || "admin";

  if (nextAdminNote) {
    notesObject.adminProfileNote = nextAdminNote;
  } else {
    delete notesObject.adminProfileNote;
  }

  if (typeof nextChapter === "string" && nextChapter !== (existing.chapter ?? null)) {
    const chapterHistory = Array.isArray(notesObject.chapterAssignmentHistory)
      ? [...notesObject.chapterAssignmentHistory]
      : [];
    chapterHistory.push({
      at: new Date().toISOString(),
      by: actor,
      from: existing.chapter ?? "No chapter",
      to: nextChapter,
      note: nextAdminNote ?? "",
    });
    notesObject.chapterAssignmentHistory = chapterHistory;
  }

  return prisma.$transaction(async (tx) => {
    if (nextApplicantName) {
      await tx.user.update({
        where: { id: existing.applicantId },
        data: { name: nextApplicantName },
      });
    }

    return tx.application.update({
      where: { id: existing.id },
      data: {
        chapter: nextChapter,
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
