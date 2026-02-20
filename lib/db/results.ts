import { prisma } from "@/lib/prisma";
import { parseApplicationMetadata } from "@/lib/application-metadata";

export type RankedResult = {
  rank: number;
  tied: boolean;
  applicationId: string;
  applicantName: string;
  voicePart: string | null;
  status: string;
  totalScore: number;
  judgeCount: number;
  criterionAverages: Array<{
    criteriaId: string;
    criteriaName: string;
    order: number;
    average: number;
  }>;
};

export type RoundResultsSummary = {
  roundId: string;
  roundName: string;
  roundType: string;
  applicationCount: number;
  averageTotalScore: number;
  highestScore: number;
  lowestScore: number;
  results: RankedResult[];
};

export async function getRankedResultsForRound(
  roundId: string
): Promise<RankedResult[]> {
  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      judgeAssignments: {
        select: { judgeId: true },
      },
      event: {
        include: {
          rubric: {
            include: {
              criteria: {
                orderBy: { order: "asc" },
              },
            },
          },
          applications: {
            include: {
              applicant: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
  });

  if (!round || !round.event.rubric) return [];

  const { criteria } = round.event.rubric;
  const judgeIds = round.judgeAssignments.map((a) => a.judgeId);

  if (judgeIds.length === 0 || criteria.length === 0) return [];

  const applicationIds = round.event.applications.map((a) => a.id);
  if (applicationIds.length === 0) return [];

  // Fetch all scores from judges assigned to this round
  const allScores = await prisma.score.findMany({
    where: {
      applicationId: { in: applicationIds },
      criteriaId: { in: criteria.map((c) => c.id) },
      judgeId: { in: judgeIds },
    },
    select: {
      applicationId: true,
      criteriaId: true,
      judgeId: true,
      value: true,
    },
  });

  // Only include applications that have at least one score
  const scoredAppIds = new Set(allScores.map((s) => s.applicationId));
  const scoredApplications = round.event.applications.filter((a) =>
    scoredAppIds.has(a.id)
  );

  if (scoredApplications.length === 0) return [];

  // Build per-application per-criterion averages
  type ScoreKey = `${string}:${string}`;
  const scoresByKey = new Map<ScoreKey, number[]>();

  for (const score of allScores) {
    const key: ScoreKey = `${score.applicationId}:${score.criteriaId}`;
    const existing = scoresByKey.get(key) ?? [];
    existing.push(score.value);
    scoresByKey.set(key, existing);
  }

  // For each application, compute judge count and criterion averages + total
  const ranked = scoredApplications.map((application) => {
    const criterionAverages = criteria.map((criterion) => {
      const key: ScoreKey = `${application.id}:${criterion.id}`;
      const values = scoresByKey.get(key) ?? [];
      const average =
        values.length > 0
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : 0;
      return {
        criteriaId: criterion.id,
        criteriaName: criterion.name,
        order: criterion.order,
        average,
      };
    });

    // Total score = sum of per-criterion averages (max 100 for 10 criteria × 10 pts)
    const totalScore = criterionAverages.reduce(
      (sum, c) => sum + c.average,
      0
    );

    // Judge count = unique judges who scored this application for this round
    const judgesForApp = new Set(
      allScores
        .filter((s) => s.applicationId === application.id)
        .map((s) => s.judgeId)
    );

    const metadata = parseApplicationMetadata(application.notes);

    return {
      rank: 0, // filled in below
      tied: false,
      applicationId: application.id,
      applicantName: application.applicant.name,
      voicePart: metadata.voicePart,
      status: application.status as string,
      totalScore,
      judgeCount: judgesForApp.size,
      criterionAverages,
    };
  });

  // Sort by total score descending
  ranked.sort((a, b) => b.totalScore - a.totalScore);

  // Assign ranks with tie detection (round to 2 decimal places for comparison)
  let currentRank = 1;
  for (let i = 0; i < ranked.length; i++) {
    if (i === 0) {
      ranked[i].rank = 1;
    } else {
      const prev = ranked[i - 1].totalScore;
      const curr = ranked[i].totalScore;
      if (Math.abs(prev - curr) < 0.001) {
        ranked[i].rank = ranked[i - 1].rank;
        ranked[i].tied = true;
        ranked[i - 1].tied = true;
      } else {
        currentRank = i + 1;
        ranked[i].rank = currentRank;
      }
    }
  }

  return ranked;
}

export async function getResultsSummaryForEvent(
  eventId: string
): Promise<RoundResultsSummary[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      rounds: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!event) return [];

  const summaries = await Promise.all(
    event.rounds.map(async (round) => {
      const results = await getRankedResultsForRound(round.id);

      const scores = results.map((r) => r.totalScore);
      const applicationCount = results.length;
      const averageTotalScore =
        applicationCount > 0
          ? scores.reduce((s, v) => s + v, 0) / applicationCount
          : 0;
      const highestScore = applicationCount > 0 ? Math.max(...scores) : 0;
      const lowestScore = applicationCount > 0 ? Math.min(...scores) : 0;

      return {
        roundId: round.id,
        roundName: round.name,
        roundType: round.type as string,
        applicationCount,
        averageTotalScore,
        highestScore,
        lowestScore,
        results,
      };
    })
  );

  return summaries;
}
