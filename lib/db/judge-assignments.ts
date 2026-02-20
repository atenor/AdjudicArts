import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const ASSIGNABLE_ROLES = [Role.CHAPTER_JUDGE, Role.NATIONAL_JUDGE];

export async function getJudgesForOrg(organizationId: string) {
  return prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ASSIGNABLE_ROLES },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

export async function assignJudgeToRound(
  judgeId: string,
  roundId: string,
  organizationId: string
) {
  const round = await prisma.round.findFirst({
    where: { id: roundId, organizationId },
    select: { id: true, type: true },
  });

  if (!round) {
    return { ok: false as const, reason: "ROUND_NOT_FOUND" as const };
  }

  const judge = await prisma.user.findFirst({
    where: { id: judgeId, organizationId },
    select: { id: true, role: true },
  });

  if (!judge) {
    return { ok: false as const, reason: "JUDGE_NOT_FOUND" as const };
  }

  const expectedRole =
    round.type === "CHAPTER" ? Role.CHAPTER_JUDGE : Role.NATIONAL_JUDGE;

  if (judge.role !== expectedRole) {
    return { ok: false as const, reason: "ROLE_MISMATCH" as const };
  }

  await prisma.judgeAssignment.upsert({
    where: {
      judgeId_roundId: { judgeId, roundId },
    },
    update: {},
    create: {
      organizationId,
      judgeId,
      roundId,
    },
  });

  return { ok: true as const };
}

export async function getAssignmentsForRound(roundId: string) {
  return prisma.judgeAssignment.findMany({
    where: { roundId },
    include: {
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: [{ judge: { role: "asc" } }, { judge: { name: "asc" } }],
  });
}

export async function removeJudgeFromRound(judgeId: string, roundId: string) {
  await prisma.judgeAssignment.deleteMany({
    where: { judgeId, roundId },
  });

  return getAssignmentsForRound(roundId);
}
