import { prisma } from "@/lib/prisma";
import {
  ApplicationStatus,
  Role,
  RoundType,
  ScoreRound,
} from "@prisma/client";
import {
  ApplicationDivision,
  resolveApplicationDivision,
} from "@/lib/application-division";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { getYouTubeVideoId } from "@/lib/youtube";
import {
  getJudgeSubmission,
  getRoundCertification,
} from "@/lib/db/governance";

const FINAL_COMMENT_PREFIX = "__ADJUDICARTS_FINAL_COMMENT__:";

function normalizeChapter(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function chapterMatchKey(value: string | null | undefined) {
  const normalized = normalizeChapter(value);
  if (!normalized) return "";

  const withoutParens = normalized.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim();
  const base = withoutParens.split(/[–—-]/)[0]?.trim() ?? withoutParens;
  return base.replace(/\bchapter\b/g, "").replace(/\s+/g, " ").trim();
}

function isChapterMatch(
  applicationChapter: string | null | undefined,
  userChapter: string | null | undefined
) {
  const app = chapterMatchKey(applicationChapter);
  const user = chapterMatchKey(userChapter);
  if (!app || !user) return false;
  if (app === user) return true;
  if (app.length >= 3 && user.includes(app)) return true;
  if (user.length >= 3 && app.includes(user)) return true;
  return false;
}

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

function applicationStatusesForRoundType(roundType: RoundType): ApplicationStatus[] {
  if (roundType === "CHAPTER") {
    return ["APPROVED_FOR_CHAPTER_ADJUDICATION", "CHAPTER_ADJUDICATION"];
  }
  return ["APPROVED_FOR_NATIONAL_ADJUDICATION", "NATIONAL_FINALS"];
}

function scoreRoundForRoundType(roundType: RoundType): ScoreRound {
  return roundType === "CHAPTER" ? "CHAPTER" : "NATIONAL";
}

export async function getJudgeScoringQueue(
  judgeId: string,
  organizationId: string,
  role: Role,
  options?: { division?: ApplicationDivision; userChapter?: string | null }
) {
  const assignments =
    role === "CHAPTER_JUDGE"
      ? (await prisma.round.findMany({
          where: {
            organizationId,
            type: "CHAPTER",
          },
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
          orderBy: [{ event: { name: "asc" } }, { name: "asc" }],
        })).map((round) => ({ round }))
      : await prisma.judgeAssignment.findMany({
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

      const applicationStatuses = applicationStatusesForRoundType(round.type);
      const scoreRound = scoreRoundForRoundType(round.type);
      const criteriaCount = event.rubric?.criteria.length ?? 0;

      const applications = await prisma.application.findMany({
        where: {
          organizationId,
          eventId: event.id,
          status: { in: applicationStatuses },
        },
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { submittedAt: "asc" },
      });

      const chapterScopedApplications =
        role === "CHAPTER_JUDGE"
          ? applications.filter((application) =>
              isChapterMatch(application.chapter, options?.userChapter)
            )
          : applications;

      let blockedReason: string | null = null;
      if (role === "CHAPTER_JUDGE" && options?.userChapter) {
        const unresolvedApplications = await prisma.application.findMany({
          where: {
            organizationId,
            eventId: event.id,
            status: {
              in: [
                "PENDING_APPROVAL",
                "CORRECTION_REQUIRED",
                "SUBMITTED_PENDING_APPROVAL",
                "SUBMITTED",
              ],
            },
          },
          select: { chapter: true },
        });

        const unresolvedCount = unresolvedApplications.filter((application) =>
          isChapterMatch(application.chapter, options.userChapter)
        ).length;

        if (unresolvedCount > 0) {
          blockedReason =
            "Chapter adjudication is locked until all applicants in your chapter are resolved out of pending approval or correction-required status.";
        }
      }

      const applicationIds = chapterScopedApplications.map((application) => application.id);
      const bookmarks = applicationIds.length
        ? await prisma.judgeBookmark.findMany({
            where: {
              organizationId,
              judgeId,
              applicationId: { in: applicationIds },
            },
            select: {
              applicationId: true,
            },
          })
        : [];
      const scoreCounts =
        applicationIds.length === 0
          ? []
          : await prisma.score.groupBy({
              by: ["applicationId"],
              where: {
                organizationId,
                judgeId,
                applicationId: { in: applicationIds },
                round: scoreRound,
              },
              _count: {
                applicationId: true,
              },
            });

      const submissions = applicationIds.length
        ? await prisma.judgeSubmission.findMany({
            where: {
              organizationId,
              roundId: round.id,
              judgeId,
              applicationId: { in: applicationIds },
            },
            select: {
              applicationId: true,
              status: true,
              finalizedAt: true,
            },
          })
        : [];

      const submissionByApplication = new Map(
        submissions.map((submission) => [submission.applicationId, submission])
      );
      const bookmarkedApplicationIds = new Set(
        bookmarks.map((bookmark) => bookmark.applicationId)
      );

      const scoreCountByApplication = new Map(
        scoreCounts.map((scoreCount) => [
          scoreCount.applicationId,
          scoreCount._count.applicationId,
        ])
      );

      const queueItems = chapterScopedApplications
        .map((application) => {
          const criterionScores = scoreCountByApplication.get(application.id) ?? 0;
          const submission = submissionByApplication.get(application.id);
          const isScored = submission?.status === "FINALIZED";
          const division = resolveApplicationDivision({
            notes: application.notes,
            dateOfBirth: application.dateOfBirth,
          });
          const metadata = parseApplicationMetadata(application.notes);

          return {
            id: application.id,
            headshot: application.headshot,
            chapter: application.chapter,
            status: application.status,
            division,
            voicePart: metadata.voicePart,
            submittedAt: application.submittedAt,
            applicant: application.applicant,
            isScored,
            isBookmarked: bookmarkedApplicationIds.has(application.id),
            submissionStatus: submission?.status ?? "DRAFT",
            finalizedAt: submission?.finalizedAt ?? null,
            hasAllCriteria: criteriaCount > 0 && criterionScores >= criteriaCount,
          };
        })
        .filter((item) => !options?.division || item.division === options.division);

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
        applications: blockedReason ? [] : queueItems,
        blockedReason,
      };
    })
  );

  return rows.filter((row) => row !== null);
}

export async function getScoringApplicationForJudge(
  applicationId: string,
  judgeId: string,
  organizationId: string,
  role: Role,
  userChapter?: string | null
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
        },
      },
    },
  });

  if (!application) return null;

  const expectedRoundType = role === "CHAPTER_JUDGE" ? "CHAPTER" : "NATIONAL";
  const scoreRound = scoreRoundForRoundType(expectedRoundType);
  const expectedApplicationStatuses = applicationStatusesForRoundType(expectedRoundType);
  if (!expectedApplicationStatuses.includes(application.status)) return null;
  if (role === "CHAPTER_JUDGE" && !isChapterMatch(application.chapter, userChapter)) return null;

  if (role === "CHAPTER_JUDGE" && userChapter) {
    const unresolvedApplications = await prisma.application.findMany({
      where: {
        organizationId,
        eventId: application.eventId,
        status: {
          in: [
            "PENDING_APPROVAL",
            "CORRECTION_REQUIRED",
            "SUBMITTED_PENDING_APPROVAL",
            "SUBMITTED",
          ],
        },
      },
      select: { chapter: true },
    });
    const unresolvedCount = unresolvedApplications.filter((item) =>
      isChapterMatch(item.chapter, userChapter)
    ).length;
    if (unresolvedCount > 0) return null;
  }

  const assignedRound = application.event.rounds.find((round) =>
    role === "CHAPTER_JUDGE"
      ? round.type === expectedRoundType
      : round.type === expectedRoundType && round.judgeAssignments.length > 0
  );

  if (!assignedRound) return null;
  if (!application.event.rubric) return null;

  const [submission, certification, prizeSuggestions] = await Promise.all([
    getJudgeSubmission({
      applicationId,
      judgeId,
      roundId: assignedRound.id,
    }),
    getRoundCertification(assignedRound.id),
    prisma.judgePrizeSuggestion.findMany({
      where: {
        organizationId,
        roundId: assignedRound.id,
        applicationId,
        judgeId,
      },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  const bookmark = await prisma.judgeBookmark.findUnique({
    where: {
      judgeId_applicationId: {
        judgeId,
        applicationId,
      },
    },
    select: { id: true },
  });

  const existingScores = await getScoresForApplication(
    applicationId,
    judgeId,
    organizationId,
    scoreRound
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
        round: scoreRound,
      },
      select: { comment: true },
    });
    finalComment = unpackScoreComment(firstScore?.comment ?? null).finalComment;
  }

  const metadata = parseApplicationMetadata(application.notes);
  const sanitizedApplication = {
    ...application,
    notes: JSON.stringify({
      voicePart: metadata.voicePart ?? null,
      videoUrls: metadata.videoUrls,
    }),
  };
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
    application: sanitizedApplication,
    criteria: application.event.rubric.criteria,
    existingScores,
    finalComment,
    scoreRound,
    round: {
      id: assignedRound.id,
      name: assignedRound.name,
      type: assignedRound.type,
    },
    submission,
    certification,
    isBookmarked: Boolean(bookmark),
    prizeSuggestions,
    videoUrls,
    videoTitles,
  };
}

export async function setJudgeBookmark(input: {
  organizationId: string;
  judgeId: string;
  applicationId: string;
  active: boolean;
}) {
  if (input.active) {
    return prisma.judgeBookmark.upsert({
      where: {
        judgeId_applicationId: {
          judgeId: input.judgeId,
          applicationId: input.applicationId,
        },
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        judgeId: input.judgeId,
        applicationId: input.applicationId,
      },
    });
  }

  return prisma.judgeBookmark.deleteMany({
    where: {
      organizationId: input.organizationId,
      judgeId: input.judgeId,
      applicationId: input.applicationId,
    },
  });
}

export async function getScoresForApplication(
  applicationId: string,
  judgeId: string,
  organizationId: string,
  round: ScoreRound
) {
  const scores = await prisma.score.findMany({
    where: {
      applicationId,
      judgeId,
      organizationId,
      round,
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
  round?: ScoreRound;
  value: number;
  comment?: string | null;
}) {
  const round = input.round ?? "CHAPTER";

  return prisma.score.upsert({
    where: {
      applicationId_criteriaId_judgeId_round: {
        applicationId: input.applicationId,
        criteriaId: input.criteriaId,
        judgeId: input.judgeId,
        round,
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
      round,
      value: input.value,
      comment: input.comment ?? null,
    },
  });
}
