import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  EventStatus,
  Role,
  RoundType,
} from "@prisma/client";

function isRoleRoundMatch(role: Role, roundType: RoundType): boolean {
  if (role === "CHAPTER_JUDGE") return roundType === "CHAPTER";
  if (role === "NATIONAL_JUDGE") return roundType === "NATIONAL";
  return false;
}

export function canScoreInEventStatus(role: Role, eventStatus: EventStatus): boolean {
  if (role === "CHAPTER_JUDGE") {
    return eventStatus === "CHAPTER_REVIEW";
  }
  if (role === "NATIONAL_JUDGE") {
    return eventStatus === "JUDGING" || eventStatus === "NATIONAL_REVIEW";
  }
  return false;
}

function statusForRoundType(roundType: RoundType): ApplicationStatus {
  return roundType === "CHAPTER"
    ? "CHAPTER_REVIEW"
    : "NATIONAL_REVIEW";
}

export async function getJudgeScoringQueue(
  judgeId: string,
  organizationId: string,
  role: Role
) {
  const assignments = await prisma.judgeAssignment.findMany({
    where: {
      judgeId,
      organizationId,
    },
    include: {
      round: {
        include: {
          event: {
            include: {
              rubric: {
                include: {
                  criteria: {
                    select: { id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ round: { event: { name: "asc" } } }, { round: { name: "asc" } }],
  });

  const rows = await Promise.all(
    assignments.map(async (assignment) => {
      const { round } = assignment;
      const { event } = round;
      if (!isRoleRoundMatch(role, round.type)) return null;
      if (!canScoreInEventStatus(role, event.status)) return null;

      const applicationStatus = statusForRoundType(round.type);
      const criteriaCount = event.rubric?.criteria.length ?? 0;

      const applications = await prisma.application.findMany({
        where: {
          organizationId,
          eventId: event.id,
          status: applicationStatus,
        },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      });

      const applicationIds = applications.map((application) => application.id);
      const scoreCounts =
        applicationIds.length === 0
          ? []
          : await prisma.score.groupBy({
              by: ["applicationId"],
              where: {
                organizationId,
                judgeId,
                applicationId: { in: applicationIds },
              },
              _count: {
                applicationId: true,
              },
            });

      const scoreCountByApplication = new Map(
        scoreCounts.map((scoreCount) => [
          scoreCount.applicationId,
          scoreCount._count.applicationId,
        ])
      );

      const queueItems = applications.map((application) => {
        const criterionScores = scoreCountByApplication.get(application.id) ?? 0;
        const isScored = criteriaCount > 0 && criterionScores >= criteriaCount;

        return {
          id: application.id,
          status: application.status,
          voicePart: application.notes,
          submittedAt: application.submittedAt,
          applicant: application.applicant,
          isScored,
        };
      });

      const scoredCount = queueItems.filter((item) => item.isScored).length;

      return {
        round: {
          id: round.id,
          name: round.name,
          type: round.type,
        },
        event: {
          id: event.id,
          name: event.name,
          status: event.status,
        },
        criteriaCount,
        scoredCount,
        totalCount: queueItems.length,
        applications: queueItems,
      };
    })
  );

  return rows.filter((row) => row !== null);
}

export async function getScoringApplicationForJudge(
  applicationId: string,
  judgeId: string,
  organizationId: string,
  role: Role
) {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      organizationId,
    },
    include: {
      event: {
        include: {
          rounds: {
            include: {
              judgeAssignments: {
                where: { judgeId },
                select: { judgeId: true },
              },
            },
          },
          rubric: {
            include: {
              criteria: {
                orderBy: { order: "asc" },
              },
            },
          },
        },
      },
      applicant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!application) return null;
  if (!canScoreInEventStatus(role, application.event.status)) return null;

  const expectedRoundType = role === "CHAPTER_JUDGE" ? "CHAPTER" : "NATIONAL";
  const expectedApplicationStatus =
    expectedRoundType === "CHAPTER" ? "CHAPTER_REVIEW" : "NATIONAL_REVIEW";

  if (application.status !== expectedApplicationStatus) return null;

  const hasAssignment = application.event.rounds.some(
    (round) =>
      round.type === expectedRoundType && round.judgeAssignments.length > 0
  );

  if (!hasAssignment) return null;
  if (!application.event.rubric) return null;

  const existingScores = await getScoresForApplication(
    applicationId,
    judgeId,
    organizationId
  );

  return {
    application,
    criteria: application.event.rubric.criteria,
    existingScores,
  };
}

export async function getScoresForApplication(
  applicationId: string,
  judgeId: string,
  organizationId: string
) {
  return prisma.score.findMany({
    where: {
      applicationId,
      judgeId,
      organizationId,
    },
    include: {
      criteria: {
        select: {
          id: true,
          name: true,
          order: true,
        },
      },
    },
    orderBy: { criteria: { order: "asc" } },
  });
}

export async function upsertScore(input: {
  organizationId: string;
  applicationId: string;
  criteriaId: string;
  judgeId: string;
  value: number;
  comment?: string | null;
}) {
  return prisma.score.upsert({
    where: {
      applicationId_criteriaId_judgeId: {
        applicationId: input.applicationId,
        criteriaId: input.criteriaId,
        judgeId: input.judgeId,
      },
    },
    update: {
      value: input.value,
      comment: input.comment ?? null,
    },
    create: {
      organizationId: input.organizationId,
      applicationId: input.applicationId,
      criteriaId: input.criteriaId,
      judgeId: input.judgeId,
      value: input.value,
      comment: input.comment ?? null,
    },
  });
}
