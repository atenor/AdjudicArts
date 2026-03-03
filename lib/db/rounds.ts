import { prisma } from "@/lib/prisma";
import { RoundType } from "@prisma/client";

export async function createRound(data: {
  organizationId: string;
  eventId: string;
  name: string;
  type: RoundType;
  advancementSlots?: number;
  startAt?: Date;
  endAt?: Date;
}) {
  return prisma.round.create({ data });
}
