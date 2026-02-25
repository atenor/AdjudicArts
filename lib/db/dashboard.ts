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
        status: {
          in: ["SUBMITTED_PENDING_APPROVAL", "SUBMITTED"],
        },
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
    if (row.status === "SUBMITTED" || row.status === "SUBMITTED_PENDING_APPROVAL") {
      statusBreakdown.submitted += row._count.status;
    }
    if (row.status === "CHAPTER_REVIEW" || row.status === "CHAPTER_ADJUDICATION") {
      statusBreakdown.chapterReview += row._count.status;
    }
    if (row.status === "NATIONAL_REVIEW" || row.status === "NATIONAL_FINALS") {
      statusBreakdown.nationalReview += row._count.status;
    }
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

export async function getChapterChairDashboardStats(
  organizationId: string,
  chapter: string | null | undefined
) {
  const chapterName = chapter?.trim();
  if (!chapterName) {
    return {
      chapterName: null,
      totalApplicantsForChapter: 0,
      pendingApprovalsForChapter: 0,
      chapterAdjudicationCount: 0,
      recentPendingApprovals: [],
    };
  }

  const [totalApplicantsForChapter, pendingApprovalsForChapter, chapterAdjudicationCount, recentPendingApprovals] =
    await Promise.all([
      prisma.application.count({
        where: {
          organizationId,
          chapter: { equals: chapterName, mode: "insensitive" },
        },
      }),
      prisma.application.count({
        where: {
          organizationId,
          chapter: { equals: chapterName, mode: "insensitive" },
          status: { in: ["SUBMITTED_PENDING_APPROVAL", "SUBMITTED"] },
        },
      }),
      prisma.application.count({
        where: {
          organizationId,
          status: { in: ["CHAPTER_ADJUDICATION", "CHAPTER_REVIEW"] },
        },
      }),
      prisma.application.findMany({
        where: {
          organizationId,
          chapter: { equals: chapterName, mode: "insensitive" },
          status: { in: ["SUBMITTED_PENDING_APPROVAL", "SUBMITTED"] },
        },
        orderBy: { submittedAt: "asc" },
        take: 5,
        include: {
          applicant: { select: { name: true } },
          event: { select: { id: true, name: true } },
        },
      }),
    ]);

  return {
    chapterName,
    totalApplicantsForChapter,
    pendingApprovalsForChapter,
    chapterAdjudicationCount,
    recentPendingApprovals,
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
  const scoreRound = role === "CHAPTER_JUDGE" ? "CHAPTER" : "NATIONAL";
  const appStatus =
    role === "CHAPTER_JUDGE"
      ? (["CHAPTER_ADJUDICATION"] as const)
      : (["NATIONAL_FINALS"] as const);

  // Rounds this judge is assigned to
  const assignments = await prisma.judgeAssignment.findMany({
    where: {
      judgeId,
      organizationId,
      round: { type: roundType },
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
      currentRoundLabel:
        role === "CHAPTER_JUDGE" ? "Chapter Adjudication" : "National Finals",
      totalToJudgeCurrentRound: 0,
      completedByJudgeCurrentRound: 0,
      hasSavedWork: false,
      roundCount: assignments.length,
    };
  }

  // All applications in the relevant events at the right status
  const eventIds = Array.from(new Set(assignments.map((a) => a.round.eventId)));

  const applications = await prisma.application.findMany({
    where: { organizationId, eventId: { in: eventIds }, status: { in: [...appStatus] } },
    select: { id: true, eventId: true },
  });

  const totalToJudgeCurrentRound = applications.length;

  if (totalToJudgeCurrentRound === 0) {
    return {
      currentRoundLabel:
        role === "CHAPTER_JUDGE" ? "Chapter Adjudication" : "National Finals",
      totalToJudgeCurrentRound: 0,
      completedByJudgeCurrentRound: 0,
      hasSavedWork: false,
      roundCount: assignments.length,
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
    where: {
      judgeId,
      applicationId: { in: applicationIds },
      organizationId,
      round: scoreRound,
    },
    _count: { applicationId: true },
  });

  const scoreCountMap = new Map(
    scoreCounts.map((s) => [s.applicationId, s._count.applicationId])
  );

  let completedByJudgeCurrentRound = 0;
  for (const appId of applicationIds) {
    const eventId = eventIdByApp.get(appId)!;
    const criteriaCount = criteriaCountByEvent.get(eventId) ?? 0;
    const scored = scoreCountMap.get(appId) ?? 0;
    if (criteriaCount > 0 && scored >= criteriaCount) completedByJudgeCurrentRound += 1;
  }

  return {
    currentRoundLabel:
      role === "CHAPTER_JUDGE" ? "Chapter Adjudication" : "National Finals",
    totalToJudgeCurrentRound,
    completedByJudgeCurrentRound,
    hasSavedWork: scoreCounts.some((row) => row._count.applicationId > 0),
    roundCount: assignments.length,
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
