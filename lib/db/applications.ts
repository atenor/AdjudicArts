import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { buildApplicationMetadata } from "@/lib/application-metadata";

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
      status: ApplicationStatus.SUBMITTED,
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
  status?: ApplicationStatus
) {
  return prisma.application.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
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

export async function getApplicationById(id: string, organizationId: string) {
  return prisma.application.findFirst({
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
