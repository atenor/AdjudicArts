import { Role, RoundType, ScoreRound } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NationalJudgingResetSummary = {
  nationalRoundCount: number;
  nationalJudgeCount: number;
  nationalScoreCount: number;
  nationalSubmissionCount: number;
  finalizedSubmissionCount: number;
  nationalSubmissionEventCount: number;
  nationalPrizeSuggestionCount: number;
  nationalBookmarkCount: number;
};

async function getNationalRoundIds(organizationId: string) {
  const rounds = await prisma.round.findMany({
    where: {
      organizationId,
      type: RoundType.NATIONAL,
    },
    select: {
      id: true,
    },
  });

  return rounds.map((round) => round.id);
}

async function getNationalJudgeIds(organizationId: string) {
  const judges = await prisma.user.findMany({
    where: {
      organizationId,
      role: Role.NATIONAL_JUDGE,
    },
    select: {
      id: true,
    },
  });

  return judges.map((judge) => judge.id);
}

export async function getNationalJudgingResetSummary(
  organizationId: string
): Promise<NationalJudgingResetSummary> {
  const [nationalRoundIds, nationalJudgeIds] = await Promise.all([
    getNationalRoundIds(organizationId),
    getNationalJudgeIds(organizationId),
  ]);

  if (nationalRoundIds.length === 0) {
    return {
      nationalRoundCount: 0,
      nationalJudgeCount: nationalJudgeIds.length,
      nationalScoreCount: 0,
      nationalSubmissionCount: 0,
      finalizedSubmissionCount: 0,
      nationalSubmissionEventCount: 0,
      nationalPrizeSuggestionCount: 0,
      nationalBookmarkCount: 0,
    };
  }

  const [submissionCounts, nationalScoreCount, nationalPrizeSuggestionCount, nationalBookmarkCount] =
    await Promise.all([
      prisma.judgeSubmission.aggregate({
        where: {
          organizationId,
          roundId: { in: nationalRoundIds },
        },
        _count: {
          _all: true,
          status: true,
        },
      }),
      prisma.score.count({
        where: {
          organizationId,
          round: ScoreRound.NATIONAL,
        },
      }),
      prisma.judgePrizeSuggestion.count({
        where: {
          organizationId,
          roundId: { in: nationalRoundIds },
        },
      }),
      nationalJudgeIds.length > 0
        ? prisma.judgeBookmark.count({
            where: {
              organizationId,
              judgeId: { in: nationalJudgeIds },
            },
          })
        : Promise.resolve(0),
    ]);

  const submissionIds = await prisma.judgeSubmission.findMany({
    where: {
      organizationId,
      roundId: { in: nationalRoundIds },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const finalizedSubmissionCount = submissionIds.filter(
    (submission) => submission.status === "FINALIZED"
  ).length;

  const nationalSubmissionEventCount =
    submissionIds.length > 0
      ? await prisma.judgeSubmissionEvent.count({
          where: {
            organizationId,
            submissionId: { in: submissionIds.map((submission) => submission.id) },
          },
        })
      : 0;

  return {
    nationalRoundCount: nationalRoundIds.length,
    nationalJudgeCount: nationalJudgeIds.length,
    nationalScoreCount,
    nationalSubmissionCount: submissionCounts._count._all,
    finalizedSubmissionCount,
    nationalSubmissionEventCount,
    nationalPrizeSuggestionCount,
    nationalBookmarkCount,
  };
}

export async function resetNationalJudgingTestData(organizationId: string) {
  const [nationalRoundIds, nationalJudgeIds, before] = await Promise.all([
    getNationalRoundIds(organizationId),
    getNationalJudgeIds(organizationId),
    getNationalJudgingResetSummary(organizationId),
  ]);

  if (nationalRoundIds.length === 0) {
    return {
      before,
      after: before,
      deleted: {
        scores: 0,
        submissions: 0,
        submissionEvents: 0,
        prizeSuggestions: 0,
        bookmarks: 0,
      },
    };
  }

  const submissionIds = await prisma.judgeSubmission.findMany({
    where: {
      organizationId,
      roundId: { in: nationalRoundIds },
    },
    select: {
      id: true,
    },
  });

  const deleted = await prisma.$transaction(async (tx) => {
    const deletedSubmissionEvents =
      submissionIds.length > 0
        ? await tx.judgeSubmissionEvent.deleteMany({
            where: {
              organizationId,
              submissionId: { in: submissionIds.map((submission) => submission.id) },
            },
          })
        : { count: 0 };

    const deletedPrizeSuggestions = await tx.judgePrizeSuggestion.deleteMany({
      where: {
        organizationId,
        roundId: { in: nationalRoundIds },
      },
    });

    const deletedSubmissions = await tx.judgeSubmission.deleteMany({
      where: {
        organizationId,
        roundId: { in: nationalRoundIds },
      },
    });

    const deletedScores = await tx.score.deleteMany({
      where: {
        organizationId,
        round: ScoreRound.NATIONAL,
      },
    });

    const deletedBookmarks =
      nationalJudgeIds.length > 0
        ? await tx.judgeBookmark.deleteMany({
            where: {
              organizationId,
              judgeId: { in: nationalJudgeIds },
            },
          })
        : { count: 0 };

    return {
      scores: deletedScores.count,
      submissions: deletedSubmissions.count,
      submissionEvents: deletedSubmissionEvents.count,
      prizeSuggestions: deletedPrizeSuggestions.count,
      bookmarks: deletedBookmarks.count,
    };
  });

  const after = await getNationalJudgingResetSummary(organizationId);

  return {
    before,
    after,
    deleted,
  };
}
