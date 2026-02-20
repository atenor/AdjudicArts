import { prisma } from "@/lib/prisma";
import { ApplicationStatus, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

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
      notes: data.voicePart,
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
