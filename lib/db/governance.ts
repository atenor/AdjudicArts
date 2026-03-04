import {
  ApplicationStatus,
  AudienceFavoriteDispositionStatus,
  AudienceFavoriteSnapshotType,
  JudgeSubmissionEventType,
  JudgeSubmissionStatus,
  Role,
  RoundType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

function applicationStatusesForRoundType(roundType: RoundType): ApplicationStatus[] {
  return roundType === "CHAPTER"
    ? ["APPROVED_FOR_CHAPTER_ADJUDICATION", "CHAPTER_ADJUDICATION"]
    : [
        "PENDING_NATIONAL_ACCEPTANCE",
        "CHAPTER_APPROVED",
        "APPROVED_FOR_NATIONAL_ADJUDICATION",
        "NATIONAL_FINALS",
        "NATIONAL_REVIEW",
      ];
}

async function getCompleteScorecardPairs(input: {
  organizationId: string;
  applicationIds: string[];
  judgeIds: string[];
  scoreRound: "CHAPTER" | "NATIONAL";
  criteriaCount: number;
}) {
  if (
    input.applicationIds.length === 0 ||
    input.judgeIds.length === 0 ||
    input.criteriaCount === 0
  ) {
    return new Set<string>();
  }

  const scoreCounts = await prisma.score.groupBy({
    by: ["applicationId", "judgeId"],
    where: {
      organizationId: input.organizationId,
      applicationId: { in: input.applicationIds },
      judgeId: { in: input.judgeIds },
      round: input.scoreRound,
    },
    _count: {
      applicationId: true,
    },
  });

  return new Set(
    scoreCounts
      .filter((entry) => entry._count.applicationId >= input.criteriaCount)
      .map((entry) => `${entry.applicationId}:${entry.judgeId}`)
  );
}

export async function getAssignedRoundForJudge(input: {
  eventId: string;
  judgeId: string;
  roundType: RoundType;
}) {
  return prisma.round.findFirst({
    where: {
      eventId: input.eventId,
      type: input.roundType,
      judgeAssignments: {
        some: {
          judgeId: input.judgeId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      type: true,
      eventId: true,
      organizationId: true,
    },
  });
}

export async function getRoundCertification(roundId: string) {
  return prisma.roundCertification.findUnique({
    where: { roundId },
    include: {
      certifiedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

export async function getJudgeSubmission(input: {
  applicationId: string;
  judgeId: string;
  roundId: string;
}) {
  return prisma.judgeSubmission.findUnique({
    where: {
      applicationId_judgeId_roundId: {
        applicationId: input.applicationId,
        judgeId: input.judgeId,
        roundId: input.roundId,
      },
    },
    include: {
      events: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function touchJudgeSubmissionDraft(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  applicationId: string;
  judgeId: string;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) {
    return { reason: "ROUND_CERTIFIED" as const };
  }

  const submission = await prisma.judgeSubmission.upsert({
    where: {
      applicationId_judgeId_roundId: {
        applicationId: input.applicationId,
        judgeId: input.judgeId,
        roundId: input.roundId,
      },
    },
    update: {
      status: JudgeSubmissionStatus.DRAFT,
      finalizedAt: null,
    },
    create: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      roundId: input.roundId,
      applicationId: input.applicationId,
      judgeId: input.judgeId,
      status: JudgeSubmissionStatus.DRAFT,
    },
  });

  return { reason: "OK" as const, submission };
}

export async function finalizeJudgeSubmission(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  applicationId: string;
  judgeId: string;
  actorUserId: string;
  actorRole: Role;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) {
    return { reason: "ROUND_CERTIFIED" as const };
  }

  const submission = await prisma.$transaction(async (tx) => {
    const current = await tx.judgeSubmission.upsert({
      where: {
        applicationId_judgeId_roundId: {
          applicationId: input.applicationId,
          judgeId: input.judgeId,
          roundId: input.roundId,
        },
      },
      update: {},
      create: {
        organizationId: input.organizationId,
        eventId: input.eventId,
        roundId: input.roundId,
        applicationId: input.applicationId,
        judgeId: input.judgeId,
        status: JudgeSubmissionStatus.DRAFT,
      },
    });

    const finalized = await tx.judgeSubmission.update({
      where: { id: current.id },
      data: {
        status: JudgeSubmissionStatus.FINALIZED,
        finalizedAt: new Date(),
      },
      include: {
        events: {
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await tx.judgeSubmissionEvent.create({
      data: {
        organizationId: input.organizationId,
        submissionId: current.id,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        eventType: JudgeSubmissionEventType.FINALIZED,
      },
    });

    return finalized;
  });

  return { reason: "OK" as const, submission };
}

export async function reopenJudgeSubmission(input: {
  organizationId: string;
  applicationId: string;
  judgeId: string;
  roundId: string;
  actorUserId: string;
  actorRole: Role;
  reason: string;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) {
    return { reason: "ROUND_CERTIFIED" as const };
  }

  const existing = await prisma.judgeSubmission.findUnique({
    where: {
      applicationId_judgeId_roundId: {
        applicationId: input.applicationId,
        judgeId: input.judgeId,
        roundId: input.roundId,
      },
    },
  });

  if (!existing) {
    return { reason: "NOT_FOUND" as const };
  }

  if (existing.status !== JudgeSubmissionStatus.FINALIZED) {
    return { reason: "NOT_FINALIZED" as const };
  }

  const submission = await prisma.$transaction(async (tx) => {
    const reopened = await tx.judgeSubmission.update({
      where: { id: existing.id },
      data: {
        status: JudgeSubmissionStatus.DRAFT,
      },
      include: {
        events: {
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await tx.judgeSubmissionEvent.create({
      data: {
        organizationId: input.organizationId,
        submissionId: existing.id,
        actorUserId: input.actorUserId,
        actorRole: input.actorRole,
        eventType: JudgeSubmissionEventType.REOPENED,
        reason: input.reason,
      },
    });

    return reopened;
  });

  return { reason: "OK" as const, submission };
}

export async function getRoundCertificationReadiness(input: {
  organizationId: string;
  roundId: string;
}) {
  const round = await prisma.round.findFirst({
    where: {
      id: input.roundId,
      organizationId: input.organizationId,
    },
    include: {
      judgeAssignments: {
        include: {
          judge: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      event: {
        include: {
          rubric: {
            include: {
              criteria: {
                select: {
                  id: true,
                },
              },
            },
          },
          applications: {
            select: {
              id: true,
              status: true,
              applicant: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!round) return null;

  const requiredStatuses = applicationStatusesForRoundType(round.type);
  const applications = round.event.applications.filter((application) =>
    requiredStatuses.includes(application.status)
  );

  const completePairs = await getCompleteScorecardPairs({
    organizationId: input.organizationId,
    applicationIds: applications.map((application) => application.id),
    judgeIds: round.judgeAssignments.map((assignment) => assignment.judge.id),
    scoreRound: round.type === "CHAPTER" ? "CHAPTER" : "NATIONAL",
    criteriaCount: round.event.rubric?.criteria.length ?? 0,
  });

  const missing: Array<{
    applicationId: string;
    applicantName: string;
    judgeId: string;
    judgeName: string;
  }> = [];

  for (const application of applications) {
    for (const assignment of round.judgeAssignments) {
      const key = `${application.id}:${assignment.judge.id}`;
      if (!completePairs.has(key)) {
        missing.push({
          applicationId: application.id,
          applicantName: application.applicant.name,
          judgeId: assignment.judge.id,
          judgeName: assignment.judge.name,
        });
      }
    }
  }

  const certification = await getRoundCertification(round.id);

  return {
    round: {
      id: round.id,
      name: round.name,
      type: round.type,
      eventId: round.eventId,
    },
    assignedJudgeCount: round.judgeAssignments.length,
    applicationCount: applications.length,
    requiredFinalizations: round.judgeAssignments.length * applications.length,
    finalizedCount: completePairs.size,
    missing,
    certification,
  };
}

export async function certifyRound(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  actorUserId: string;
}) {
  const readiness = await getRoundCertificationReadiness({
    organizationId: input.organizationId,
    roundId: input.roundId,
  });

  if (!readiness) return { reason: "NOT_FOUND" as const };
  if (readiness.certification) return { reason: "ALREADY_CERTIFIED" as const, certification: readiness.certification };
  if (readiness.missing.length > 0) {
    return { reason: "INCOMPLETE_FINALIZATIONS" as const, readiness };
  }

  const certification = await prisma.roundCertification.create({
    data: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      roundId: input.roundId,
      certifiedById: input.actorUserId,
    },
    include: {
      certifiedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return { reason: "OK" as const, certification };
}

export async function replaceJudgePrizeSuggestions(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  applicationId: string;
  judgeId: string;
  suggestions: Array<{
    label: string;
    amountCents?: number | null;
    comment?: string | null;
  }>;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) return { reason: "ROUND_CERTIFIED" as const };

  await prisma.$transaction(async (tx) => {
    await tx.judgePrizeSuggestion.deleteMany({
      where: {
        organizationId: input.organizationId,
        roundId: input.roundId,
        applicationId: input.applicationId,
        judgeId: input.judgeId,
      },
    });

    if (input.suggestions.length > 0) {
      await tx.judgePrizeSuggestion.createMany({
        data: input.suggestions.map((suggestion, index) => ({
          organizationId: input.organizationId,
          eventId: input.eventId,
          roundId: input.roundId,
          applicationId: input.applicationId,
          judgeId: input.judgeId,
          label: suggestion.label,
          amountCents: suggestion.amountCents ?? null,
          comment: suggestion.comment ?? null,
          sortOrder: index,
        })),
      });
    }
  });

  return { reason: "OK" as const };
}

export async function listJudgePrizeSuggestionsForApplication(input: {
  organizationId: string;
  roundId: string;
  applicationId: string;
}) {
  return prisma.judgePrizeSuggestion.findMany({
    where: {
      organizationId: input.organizationId,
      roundId: input.roundId,
      applicationId: input.applicationId,
    },
    include: {
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ judge: { name: "asc" } }, { sortOrder: "asc" }],
  });
}

export async function listJudgePrizeSuggestionsForRound(input: {
  organizationId: string;
  roundId: string;
}) {
  return prisma.judgePrizeSuggestion.findMany({
    where: {
      organizationId: input.organizationId,
      roundId: input.roundId,
    },
    include: {
      application: {
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [
      { application: { applicant: { name: "asc" } } },
      { judge: { name: "asc" } },
      { sortOrder: "asc" },
    ],
  });
}

export async function replaceChairPrizeAllocations(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  actorUserId: string;
  allocations: Array<{
    applicationId: string;
    label: string;
    amountCents?: number | null;
  }>;
  internalNote?: string | null;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) return { reason: "ROUND_CERTIFIED" as const };

  const existing = await prisma.chairPrizeAllocation.findMany({
    where: {
      organizationId: input.organizationId,
      roundId: input.roundId,
    },
    orderBy: [{ applicationId: "asc" }, { sortOrder: "asc" }],
  });

  const nextNormalized = input.allocations.map((allocation, index) => ({
    applicationId: allocation.applicationId,
    label: allocation.label.trim(),
    amountCents: allocation.amountCents ?? null,
    sortOrder: index,
  }));
  const existingNormalized = existing.map((allocation) => ({
    applicationId: allocation.applicationId,
    label: allocation.label,
    amountCents: allocation.amountCents,
    sortOrder: allocation.sortOrder,
  }));

  const allocationsChanged = JSON.stringify(existingNormalized) !== JSON.stringify(nextNormalized);
  if (existing.length > 0 && allocationsChanged && !input.internalNote?.trim()) {
    return { reason: "INTERNAL_NOTE_REQUIRED" as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.chairPrizeAllocation.deleteMany({
      where: {
        organizationId: input.organizationId,
        roundId: input.roundId,
      },
    });

    if (nextNormalized.length > 0) {
      await tx.chairPrizeAllocation.createMany({
        data: nextNormalized.map((allocation) => ({
          organizationId: input.organizationId,
          eventId: input.eventId,
          roundId: input.roundId,
          applicationId: allocation.applicationId,
          label: allocation.label,
          amountCents: allocation.amountCents,
          sortOrder: allocation.sortOrder,
          internalNote: input.internalNote?.trim() || null,
          createdById: input.actorUserId,
        })),
      });
    }
  });

  return { reason: "OK" as const };
}

export async function listChairPrizeAllocationsForRound(input: {
  organizationId: string;
  roundId: string;
}) {
  return prisma.chairPrizeAllocation.findMany({
    where: {
      organizationId: input.organizationId,
      roundId: input.roundId,
    },
    include: {
      application: {
        include: {
          applicant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ application: { applicant: { name: "asc" } } }, { sortOrder: "asc" }],
  });
}

export async function saveAudienceFavoriteSnapshot(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  actorUserId: string;
  snapshotType: AudienceFavoriteSnapshotType;
  entries: Array<{
    applicationId: string;
    viewCount: number;
  }>;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) return { reason: "ROUND_CERTIFIED" as const };

  await prisma.$transaction(async (tx) => {
    for (const entry of input.entries) {
      await tx.audienceFavoriteSnapshot.upsert({
        where: {
          roundId_applicationId_snapshotType: {
            roundId: input.roundId,
            applicationId: entry.applicationId,
            snapshotType: input.snapshotType,
          },
        },
        update: {
          viewCount: entry.viewCount,
          capturedById: input.actorUserId,
          capturedAt: new Date(),
        },
        create: {
          organizationId: input.organizationId,
          eventId: input.eventId,
          roundId: input.roundId,
          applicationId: entry.applicationId,
          snapshotType: input.snapshotType,
          viewCount: entry.viewCount,
          capturedById: input.actorUserId,
        },
      });
    }
  });

  return { reason: "OK" as const };
}

export async function setAudienceFavoriteDisposition(input: {
  organizationId: string;
  eventId: string;
  roundId: string;
  applicationId: string;
  actorUserId: string;
  status: AudienceFavoriteDispositionStatus;
  note: string;
}) {
  const certification = await getRoundCertification(input.roundId);
  if (certification) return { reason: "ROUND_CERTIFIED" as const };

  const disposition = await prisma.audienceFavoriteDisposition.upsert({
    where: {
      roundId_applicationId: {
        roundId: input.roundId,
        applicationId: input.applicationId,
      },
    },
    update: {
      status: input.status,
      note: input.note,
      actedById: input.actorUserId,
      actedAt: new Date(),
    },
    create: {
      organizationId: input.organizationId,
      eventId: input.eventId,
      roundId: input.roundId,
      applicationId: input.applicationId,
      status: input.status,
      note: input.note,
      actedById: input.actorUserId,
    },
  });

  return { reason: "OK" as const, disposition };
}

export async function getAudienceFavoriteLeaderboard(input: {
  organizationId: string;
  roundId: string;
}) {
  const [baseline, end, dispositions] = await Promise.all([
    prisma.audienceFavoriteSnapshot.findMany({
      where: {
        organizationId: input.organizationId,
        roundId: input.roundId,
        snapshotType: AudienceFavoriteSnapshotType.BASELINE,
      },
      include: {
        application: {
          include: {
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    }),
    prisma.audienceFavoriteSnapshot.findMany({
      where: {
        organizationId: input.organizationId,
        roundId: input.roundId,
        snapshotType: AudienceFavoriteSnapshotType.END,
      },
    }),
    prisma.audienceFavoriteDisposition.findMany({
      where: {
        organizationId: input.organizationId,
        roundId: input.roundId,
      },
      include: {
        actedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const endByApplication = new Map(end.map((snapshot) => [snapshot.applicationId, snapshot]));
  const dispositionByApplication = new Map(
    dispositions.map((disposition) => [disposition.applicationId, disposition])
  );

  const rankedEntries = baseline
    .map((baselineSnapshot) => {
      const endSnapshot = endByApplication.get(baselineSnapshot.applicationId);
      const disposition = dispositionByApplication.get(baselineSnapshot.applicationId);
      const endViews = endSnapshot?.viewCount ?? 0;
      const delta = endViews - baselineSnapshot.viewCount;

      return {
        applicationId: baselineSnapshot.applicationId,
        applicantName: baselineSnapshot.application.applicant.name,
        baselineViews: baselineSnapshot.viewCount,
        endViews,
        delta,
        dispositionStatus: disposition?.status ?? AudienceFavoriteDispositionStatus.ELIGIBLE,
        dispositionNote: disposition?.note ?? null,
        dispositionActorName: disposition?.actedBy.name ?? null,
        dispositionActedAt: disposition?.actedAt ?? null,
      };
    })
    .sort((left, right) => right.delta - left.delta || left.applicantName.localeCompare(right.applicantName));

  let nextRank = 1;
  return rankedEntries.map((entry) => {
    if (entry.dispositionStatus === AudienceFavoriteDispositionStatus.DISQUALIFIED) {
      return {
        ...entry,
        rank: null,
      };
    }

    const rankedEntry = {
      ...entry,
      rank: nextRank,
    };
    nextRank += 1;
    return rankedEntry;
  });
}

export async function listJudgeSubmissionsForApplication(input: {
  organizationId: string;
  applicationId: string;
}) {
  return prisma.judgeSubmission.findMany({
    where: {
      organizationId: input.organizationId,
      applicationId: input.applicationId,
    },
    include: {
      judge: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      round: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      events: {
        include: {
          actor: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: [{ round: { name: "asc" } }, { judge: { name: "asc" } }],
  });
}
