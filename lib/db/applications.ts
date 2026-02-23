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
