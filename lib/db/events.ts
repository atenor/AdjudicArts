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
