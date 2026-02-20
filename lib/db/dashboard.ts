import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

// ---------------------------------------------------------------------------
// ADMIN / NATIONAL_CHAIR
// ---------------------------------------------------------------------------

export async function getAdminDashboardStats(organizationId: string) {
  const [
    totalEvents,
    openEvents,
    totalApplications,
    pendingApplications,
    recentApplications,
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
  ]);

  return {
    totalEvents,
    openEvents,
    totalApplications,
    pendingApplications,
    recentApplications,
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
    return { totalToScore: 0, totalScored: 0, roundCount: assignments.length };
  }

  // All applications in the relevant events at the right status
  const eventIds = Array.from(new Set(assignments.map((a) => a.round.eventId)));

  const applications = await prisma.application.findMany({
    where: { organizationId, eventId: { in: eventIds }, status: appStatus },
    select: { id: true, eventId: true },
  });

  const totalToScore = applications.length;

  if (totalToScore === 0) {
    return { totalToScore: 0, totalScored: 0, roundCount: assignments.length };
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
  for (const appId of applicationIds) {
    const eventId = eventIdByApp.get(appId)!;
    const criteriaCount = criteriaCountByEvent.get(eventId) ?? 0;
    const scored = scoreCountMap.get(appId) ?? 0;
    if (criteriaCount > 0 && scored >= criteriaCount) totalScored++;
  }

  return {
    totalToScore,
    totalScored,
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
