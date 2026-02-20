import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  EventStatus,
  Role,
  RoundType,
} from "@prisma/client";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { getYouTubeVideoId } from "@/lib/youtube";

const FINAL_COMMENT_PREFIX = "__ADJUDICARTS_FINAL_COMMENT__:";

function unpackScoreComment(stored: string | null) {
  if (!stored) {
    return { criterionComment: null as string | null, finalComment: null as string | null };
  }

  if (!stored.startsWith(FINAL_COMMENT_PREFIX)) {
    return { criterionComment: stored, finalComment: null as string | null };
  }

  try {
    const json = JSON.parse(
      stored.slice(FINAL_COMMENT_PREFIX.length)
    ) as { criterionComment?: string | null; finalComment?: string | null };
    return {
      criterionComment: json.criterionComment ?? null,
      finalComment: json.finalComment ?? null,
    };
  } catch {
    return { criterionComment: stored, finalComment: null as string | null };
  }
}

function extractYouTubeUrlsFromText(text: string | null | undefined) {
  if (!text) return [] as string[];
  const urls = text.match(/https?:\/\/[^\s)]+/g) ?? [];
  return urls
    .filter((url) => Boolean(getYouTubeVideoId(url)))
    .slice(0, 3);
}

export function packScoreComment(
  criterionComment: string | null | undefined,
  finalComment: string | null | undefined
) {
  const normalizedCriterionComment = criterionComment?.trim() || null;
  const normalizedFinalComment = finalComment?.trim() || null;

  if (!normalizedFinalComment) {
    return normalizedCriterionComment;
  }

  return (
    FINAL_COMMENT_PREFIX +
    JSON.stringify({
      criterionComment: normalizedCriterionComment,
      finalComment: normalizedFinalComment,
    })
  );
}

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
  const firstCriterionId = application.event.rubric.criteria[0]?.id;
  let finalComment: string | null = null;
  if (firstCriterionId) {
    const firstScore = await prisma.score.findFirst({
      where: {
        applicationId,
        organizationId,
        judgeId,
        criteriaId: firstCriterionId,
      },
      select: { comment: true },
    });
    finalComment = unpackScoreComment(firstScore?.comment ?? null).finalComment;
  }

  const metadata = parseApplicationMetadata(application.notes);
  const importedVideoUrls = [
    application.video1Url,
    application.video2Url,
    application.video3Url,
  ].filter((url): url is string => Boolean(url));

  const videoUrls =
    importedVideoUrls.length > 0
      ? importedVideoUrls
      : metadata.videoUrls.length > 0
        ? metadata.videoUrls
        : extractYouTubeUrlsFromText(application.repertoire);

  const videoTitles = [
    application.video1Title,
    application.video2Title,
    application.video3Title,
  ].map((title) => title?.trim() || null);

  return {
    application,
    criteria: application.event.rubric.criteria,
    existingScores,
    finalComment,
    videoUrls,
    videoTitles,
  };
}

export async function getScoresForApplication(
  applicationId: string,
  judgeId: string,
  organizationId: string
) {
  const scores = await prisma.score.findMany({
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

  return scores.map((score) => ({
    ...score,
    comment: unpackScoreComment(score.comment).criterionComment,
  }));
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
