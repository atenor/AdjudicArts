import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

function getLastNDays(n: number) {
  const dates: Date[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setHours(0, 0, 0, 0);
    d.setDate(today.getDate() - i);
    dates.push(d);
  }
  return dates;
}

// ---------------------------------------------------------------------------
// ADMIN / NATIONAL_CHAIR
// ---------------------------------------------------------------------------

export async function getAdminDashboardStats(organizationId: string) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    totalEvents,
    openEvents,
    totalApplications,
    pendingApplications,
    recentApplications,
    statusCounts,
    recentSubmissions,
  ] = await Promise.all([
    prisma.event.count({ where: { organizationId } }),
    prisma.event.count({
      where: { organizationId, status: { in: ["OPEN", "CHAPTER_REVIEW", "JUDGING", "NATIONAL_REVIEW"] } },
    }),
    prisma.application.count({ where: { organizationId } }),
    prisma.application.count({
      where: {
        organizationId,
        status: { in: ["SUBMITTED", "CHAPTER_REVIEW", "NATIONAL_REVIEW"] },
      },
    }),
    prisma.application.findMany({
      where: { organizationId },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: {
        applicant: { select: { name: true } },
        event: { select: { id: true, name: true } },
      },
    }),
    prisma.application.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { status: true },
    }),
    prisma.application.findMany({
      where: { organizationId, submittedAt: { gte: sevenDaysAgo } },
      select: { submittedAt: true },
    }),
  ]);

  const statusBreakdown = {
    submitted: 0,
    chapterReview: 0,
    nationalReview: 0,
    decided: 0,
  };

  for (const row of statusCounts) {
    if (row.status === "SUBMITTED") statusBreakdown.submitted = row._count.status;
    if (row.status === "CHAPTER_REVIEW") statusBreakdown.chapterReview = row._count.status;
    if (row.status === "NATIONAL_REVIEW") statusBreakdown.nationalReview = row._count.status;
    if (row.status === "DECIDED") statusBreakdown.decided = row._count.status;
  }

  const last7Days = getLastNDays(7);
  const submissionsLast7Days = last7Days.map((date) => {
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const count = recentSubmissions.filter(
      (s) => s.submittedAt >= date && s.submittedAt < next
    ).length;
    return {
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      count,
    };
  });

  return {
    totalEvents,
    openEvents,
    totalApplications,
    pendingApplications,
    recentApplications,
    statusBreakdown,
    submissionsLast7Days,
  };
}

// ---------------------------------------------------------------------------
// CHAPTER_CHAIR
// ---------------------------------------------------------------------------

export async function getChapterChairDashboardStats(organizationId: string) {
  const [eventsInChapterReview, applicationsInReview, recentApplications] =
    await Promise.all([
      prisma.event.count({
        where: { organizationId, status: "CHAPTER_REVIEW" },
      }),
      prisma.application.count({
        where: { organizationId, status: "CHAPTER_REVIEW" },
      }),
      prisma.application.findMany({
        where: { organizationId, status: "CHAPTER_REVIEW" },
        orderBy: { submittedAt: "asc" },
        take: 5,
        include: {
          applicant: { select: { name: true } },
          event: { select: { id: true, name: true } },
        },
      }),
    ]);

  return {
    eventsInChapterReview,
    applicationsInReview,
    recentApplications,
  };
}

// ---------------------------------------------------------------------------
// CHAPTER_JUDGE / NATIONAL_JUDGE
// ---------------------------------------------------------------------------

export async function getJudgeDashboardStats(
  judgeId: string,
  organizationId: string,
  role: Role
) {
  const roundType = role === "CHAPTER_JUDGE" ? "CHAPTER" : "NATIONAL";
  const appStatus =
    role === "CHAPTER_JUDGE" ? "CHAPTER_REVIEW" : "NATIONAL_REVIEW";
  const eventStatuses =
    role === "CHAPTER_JUDGE"
      ? (["CHAPTER_REVIEW"] as const)
      : (["JUDGING", "NATIONAL_REVIEW"] as const);

  // Rounds this judge is assigned to
  const assignments = await prisma.judgeAssignment.findMany({
    where: {
      judgeId,
      organizationId,
      round: { type: roundType, event: { status: { in: [...eventStatuses] } } },
    },
    include: {
      round: {
        include: {
          event: {
            include: {
              rubric: { include: { criteria: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });

  if (assignments.length === 0) {
    return {
      totalToScore: 0,
      totalScored: 0,
      roundCount: assignments.length,
      partiallyScored: 0,
      untouched: 0,
      completionRate: 0,
      scoredLast7Days: 0,
      assignedByEvent: [] as Array<{ eventName: string; count: number }>,
    };
  }

  // All applications in the relevant events at the right status
  const eventIds = Array.from(new Set(assignments.map((a) => a.round.eventId)));

  const applications = await prisma.application.findMany({
    where: { organizationId, eventId: { in: eventIds }, status: appStatus },
    select: { id: true, eventId: true },
  });

  const totalToScore = applications.length;

  if (totalToScore === 0) {
    return {
      totalToScore: 0,
      totalScored: 0,
      roundCount: assignments.length,
      partiallyScored: 0,
      untouched: 0,
      completionRate: 0,
      scoredLast7Days: 0,
      assignedByEvent: [] as Array<{ eventName: string; count: number }>,
    };
  }

  // For each application, check if judge has scored all criteria
  const applicationIds = applications.map((a) => a.id);

  // Get max criteria count across all involved rubrics
  const criteriaCountByEvent = new Map<string, number>();
  for (const assignment of assignments) {
    const eventId = assignment.round.eventId;
    if (!criteriaCountByEvent.has(eventId)) {
      criteriaCountByEvent.set(
        eventId,
        assignment.round.event.rubric?.criteria.length ?? 0
      );
    }
  }

  const eventIdByApp = new Map(applications.map((a) => [a.id, a.eventId]));

  const scoreCounts = await prisma.score.groupBy({
    by: ["applicationId"],
    where: { judgeId, applicationId: { in: applicationIds }, organizationId },
    _count: { applicationId: true },
  });

  const scoreCountMap = new Map(
    scoreCounts.map((s) => [s.applicationId, s._count.applicationId])
  );

  let totalScored = 0;
  let partiallyScored = 0;
  let untouched = 0;
  for (const appId of applicationIds) {
    const eventId = eventIdByApp.get(appId)!;
    const criteriaCount = criteriaCountByEvent.get(eventId) ?? 0;
    const scored = scoreCountMap.get(appId) ?? 0;
    if (criteriaCount > 0 && scored >= criteriaCount) totalScored++;
    else if (scored > 0) partiallyScored++;
    else untouched++;
  }

  const recentScoreCutoff = new Date();
  recentScoreCutoff.setDate(recentScoreCutoff.getDate() - 6);
  recentScoreCutoff.setHours(0, 0, 0, 0);

  const recentScoredApps = await prisma.score.groupBy({
    by: ["applicationId"],
    where: {
      judgeId,
      organizationId,
      applicationId: { in: applicationIds },
      updatedAt: { gte: recentScoreCutoff },
    },
    _count: { applicationId: true },
  });

  const eventNameById = new Map(
    assignments.map((a) => [a.round.eventId, a.round.event.name])
  );
  const workloadCounts = new Map<string, number>();
  for (const app of applications) {
    workloadCounts.set(app.eventId, (workloadCounts.get(app.eventId) ?? 0) + 1);
  }

  const assignedByEvent = Array.from(workloadCounts.entries())
    .map(([eventId, count]) => ({
      eventName: eventNameById.get(eventId) ?? "Event",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return {
    totalToScore,
    totalScored,
    roundCount: assignments.length,
    partiallyScored,
    untouched,
    completionRate: totalToScore > 0 ? Math.round((totalScored / totalToScore) * 100) : 0,
    scoredLast7Days: recentScoredApps.length,
    assignedByEvent,
  };
}

// ---------------------------------------------------------------------------
// APPLICANT
// ---------------------------------------------------------------------------

export async function getApplicantDashboardStats(
  applicantId: string,
  organizationId: string
) {
  const [myApplications, openEvents] = await Promise.all([
    prisma.application.findMany({
      where: { applicantId, organizationId },
      orderBy: { submittedAt: "desc" },
      take: 5,
      include: {
        event: { select: { id: true, name: true, status: true } },
      },
    }),
    prisma.event.count({ where: { organizationId, status: "OPEN" } }),
  ]);

  return {
    applicationCount: myApplications.length,
    openEvents,
    myApplications,
  };
}
