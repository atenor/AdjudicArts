import { prisma } from "@/lib/prisma";
import { EventStatus, Role } from "@prisma/client";

export async function listEventsByOrg(organizationId: string) {
  return prisma.event.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { rounds: true } },
    },
  });
}

export async function getEventById(id: string, organizationId: string) {
  return prisma.event.findFirst({
    where: { id, organizationId },
    include: {
      rounds: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function createEvent(data: {
  organizationId: string;
  name: string;
  description?: string;
  openAt?: Date;
  closeAt?: Date;
}) {
  return prisma.event.create({
    data: {
      ...data,
      status: EventStatus.DRAFT,
    },
  });
}

export async function updateEventById(
  id: string,
  organizationId: string,
  data: {
    name: string;
    description?: string;
    openAt?: Date;
    closeAt?: Date;
  }
) {
  const existing = await prisma.event.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) return null;

  return prisma.event.update({
    where: { id: existing.id },
    data,
  });
}

export async function deleteEventById(id: string, organizationId: string) {
  const event = await prisma.event.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!event) return null;

  await prisma.$transaction(async (tx) => {
    const applications = await tx.application.findMany({
      where: { eventId: event.id, organizationId },
      select: { id: true, applicantId: true },
    });
    const applicationIds = applications.map((application) => application.id);
    const applicantIds = Array.from(
      new Set(applications.map((application) => application.applicantId))
    );

    let deletedScores = 0;
    let deletedApplications = 0;
    let deletedApplicants = 0;

    if (applicationIds.length > 0) {
      const scoreDeleteResult = await tx.score.deleteMany({
        where: { organizationId, applicationId: { in: applicationIds } },
      });
      deletedScores = scoreDeleteResult.count;

      const applicationDeleteResult = await tx.application.deleteMany({
        where: { organizationId, id: { in: applicationIds } },
      });
      deletedApplications = applicationDeleteResult.count;
    }

    if (applicantIds.length > 0) {
      const applicantsWithOtherApplications = await tx.application.groupBy({
        by: ["applicantId"],
        where: {
          organizationId,
          applicantId: { in: applicantIds },
        },
        _count: { applicantId: true },
      });

      const applicantIdsWithOtherApplications = new Set(
        applicantsWithOtherApplications
          .filter((row) => row._count.applicantId > 0)
          .map((row) => row.applicantId)
      );

      const orphanApplicantIds = applicantIds.filter(
        (applicantId) => !applicantIdsWithOtherApplications.has(applicantId)
      );

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
    }

    const rounds = await tx.round.findMany({
      where: { eventId: event.id, organizationId },
      select: { id: true },
    });
    const roundIds = rounds.map((round) => round.id);

    if (roundIds.length > 0) {
      await tx.judgeAssignment.deleteMany({
        where: { organizationId, roundId: { in: roundIds } },
      });
      await tx.round.deleteMany({
        where: { organizationId, id: { in: roundIds } },
      });
    }

    const rubric = await tx.rubric.findUnique({
      where: { eventId: event.id },
      select: { id: true },
    });
    if (rubric) {
      await tx.rubricCriteria.deleteMany({ where: { rubricId: rubric.id } });
      await tx.rubric.delete({ where: { id: rubric.id } });
    }

    await tx.event.delete({ where: { id: event.id } });

    return {
      deletedScores,
      deletedApplications,
      deletedApplicants,
      deletedRounds: roundIds.length,
    };
  });

  return {
    ok: true as const,
  };
}

const STATUS_SEQUENCE: EventStatus[] = [
  EventStatus.DRAFT,
  EventStatus.OPEN,
  EventStatus.CHAPTER_REVIEW,
  EventStatus.JUDGING,
  EventStatus.NATIONAL_REVIEW,
  EventStatus.DECIDED,
  EventStatus.CLOSED,
];

export async function advanceEventStatus(id: string, organizationId: string) {
  const event = await prisma.event.findFirst({
    where: { id, organizationId },
    select: { status: true },
  });

  if (!event) return null;

  const currentIndex = STATUS_SEQUENCE.indexOf(event.status);
  if (currentIndex === -1 || currentIndex === STATUS_SEQUENCE.length - 1) {
    return null; // Already at final status
  }

  const nextStatus = STATUS_SEQUENCE[currentIndex + 1];

  return prisma.event.update({
    where: { id },
    data: { status: nextStatus },
  });
}
