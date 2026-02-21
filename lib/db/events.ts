import { prisma } from "@/lib/prisma";
import { EventStatus } from "@prisma/client";

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

  const applicationCount = await prisma.application.count({
    where: { eventId: event.id, organizationId },
  });

  if (applicationCount > 0) {
    return {
      ok: false as const,
      reason: "EVENT_HAS_APPLICATIONS",
      applicationCount,
    };
  }

  await prisma.$transaction(async (tx) => {
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
