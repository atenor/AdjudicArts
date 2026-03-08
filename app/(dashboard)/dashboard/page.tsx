export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { ROLE_LABELS } from "@/lib/roles";
import {
  getAdminDashboardStats,
  getChapterChairDashboardStats,
  getJudgeDashboardStats,
  getApplicantDashboardStats,
} from "@/lib/db/dashboard";
import { parseApplicationMetadata } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };
const JUDGING_DEADLINE = new Date("2026-04-01T23:59:00-04:00");

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function StatCard({
  title,
  value,
  sub,
  href,
}: {
  title: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  if (href) {
    return (
      <Link href={href} className={`${styles.statCard} ${styles.statCardInteractive}`}>
        <p className={styles.statLabel}>{title}</p>
        <p className={styles.statValue}>{value}</p>
        {sub ? <p className={styles.statSub}>{sub}</p> : null}
      </Link>
    );
  }

  return (
    <article className={styles.statCard}>
      <p className={styles.statLabel}>{title}</p>
      <p className={styles.statValue}>{value}</p>
      {sub ? <p className={styles.statSub}>{sub}</p> : null}
    </article>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.quickLink}>
      {label}
    </Link>
  );
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function formatDeadline(deadline: Date | null) {
  if (!deadline) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(deadline);
}

function formatDurationFromMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);
  const days = Math.floor(safeMinutes / (24 * 60));
  const hours = Math.floor((safeMinutes % (24 * 60)) / 60);
  const minutes = safeMinutes % 60;
  return `${days}d ${hours}h ${minutes}m`;
}

function getCountdownState(deadline: Date | null) {
  if (!deadline) return null;
  const now = Date.now();
  const msRemaining = deadline.getTime() - now;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  if (msRemaining <= 0) {
    const overdueMinutes = Math.floor(Math.abs(msRemaining) / (1000 * 60));
    return {
      label: "Due / Overdue",
      detail: `${formatDurationFromMinutes(overdueMinutes)} past due`,
      tone: "Danger" as const,
    };
  }

  const minutesRemaining = Math.ceil(msRemaining / (1000 * 60));
  if (msRemaining <= threeDaysMs) {
    return {
      label: "Deadline Near",
      detail: `${formatDurationFromMinutes(minutesRemaining)} left`,
      tone: "Warning" as const,
    };
  }

  return {
    label: "On Track",
    detail: `${formatDurationFromMinutes(minutesRemaining)} left`,
    tone: "Success" as const,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { user } = session;

  if (hasRole(session, "ADMIN", "NATIONAL_CHAIR")) {
    const stats = await getAdminDashboardStats(user.organizationId);
    const pipelineTotal =
      stats.statusBreakdown.submitted +
      stats.statusBreakdown.chapterReview +
      stats.statusBreakdown.nationalReview +
      stats.statusBreakdown.decided;
    const maxTrendCount = Math.max(
      1,
      ...stats.submissionsLast7Days.map((item) => item.count)
    );

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.grid4}>
          <StatCard
            title="Applications"
            value={stats.totalApplications}
            href="/dashboard/applications"
          />
          <StatCard title="Events" value={stats.totalEvents} href="/dashboard/events" />
          <StatCard
            title="Active"
            value={stats.openEvents}
            sub="open, review, or judging"
            href="/dashboard/events"
          />
          <StatCard
            title="Pending Approval"
            value={stats.pendingApplications}
            sub="awaiting approval to enter chapter adjudication"
            href="/dashboard/applications?status=PENDING_APPROVAL"
          />
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Analytics</h2>
            <div className={styles.analyticsGrid}>
              <article className={styles.analyticsCard}>
                <p className={styles.analyticsTitle}>Application Pipeline</p>
                <div className={styles.analyticsRows}>
                  {[
                    { label: "Pending Approval", value: stats.statusBreakdown.submitted },
                    { label: "Chapter Adjudication", value: stats.statusBreakdown.chapterReview },
                    { label: "National Adjudication", value: stats.statusBreakdown.nationalReview },
                    { label: "Withdrawn", value: stats.statusBreakdown.decided },
                  ].map((item) => {
                    const href =
                      item.label === "Pending Approval"
                        ? "/dashboard/applications?status=PENDING_APPROVAL"
                        : item.label === "Chapter Adjudication"
                          ? "/dashboard/applications?status=APPROVED_FOR_CHAPTER_ADJUDICATION"
                          : item.label === "National Adjudication"
                            ? "/dashboard/applications?status=APPROVED_FOR_NATIONAL_ADJUDICATION"
                            : "/dashboard/applications?status=WITHDRAWN";
                    return (
                    <Link key={item.label} href={href} className={styles.analyticsRowLink}>
                      <div className={styles.analyticsRow}>
                      <div className={styles.analyticsRowLabel}>{item.label}</div>
                      <div className={styles.analyticsBarWrap}>
                        <div
                          className={styles.analyticsBar}
                          style={{ width: `${percentage(item.value, pipelineTotal)}%` }}
                        />
                      </div>
                      <div className={styles.analyticsValue}>{item.value}</div>
                    </div>
                    </Link>
                    );
                  })}
                </div>
              </article>

              <article className={styles.analyticsCard}>
                <p className={styles.analyticsTitle}>Submissions (Last 7 Days)</p>
                <div className={styles.trendGrid}>
                  {stats.submissionsLast7Days.map((item) => (
                    <Link
                      key={item.label}
                      href="/dashboard/applications"
                      className={styles.trendItemLink}
                      title="Open applications"
                    >
                      <div className={styles.trendItem}>
                      <div className={styles.trendCount}>{item.count}</div>
                      <div className={styles.trendBarWrap}>
                        <div
                          className={styles.trendBar}
                          style={{ height: `${Math.max(10, Math.round((item.count / maxTrendCount) * 100))}%` }}
                        />
                      </div>
                      <div className={styles.trendLabel}>{item.label}</div>
                    </div>
                    </Link>
                  ))}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Recent Applications</h2>
            {stats.recentApplications.length === 0 ? (
              <p className={styles.muted}>No applications submitted yet.</p>
            ) : (
              stats.recentApplications.map((app) => {
                const meta = parseApplicationMetadata(app.notes);
                return (
                  <article className={styles.row} key={app.id}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowAvatar}>
                        <img
                          src={getDisplayHeadshot(app.headshot, app.id)}
                          alt={`${app.applicant.name} headshot`}
                          className={styles.rowAvatarImage}
                          loading="lazy"
                        />
                      </div>
                      <Link href={`/dashboard/applications/${app.id}`} className={styles.rowTitle}>
                        {app.applicant.name}
                      </Link>
                      <p className={styles.rowMeta}>
                        {app.event.name}
                        {meta.voicePart ? ` · ${meta.voicePart}` : ""}
                      </p>
                    </div>
                    <Link href={`/dashboard/applications/${app.id}`} className={styles.rowLink}>
                      View
                    </Link>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Quick Links</h2>
          <div className={styles.quickLinks}>
            <QuickLink href="/dashboard/events" label="Events" />
            <QuickLink href="/dashboard/applications" label="Applications" />
          </div>
        </section>
      </div>
    );
  }

  if (hasRole(session, "CHAPTER_CHAIR")) {
    const stats = await getChapterChairDashboardStats(
      user.organizationId,
      user.chapter,
      user.id
    );
    const chapterDashboardTitle = stats.chapterName
      ? `${stats.chapterName} Dashboard`
      : "Chapter Dashboard";
    const chapterScoreCompletion = percentage(
      stats.scorecardsFinalized,
      Math.max(1, stats.scorecardsExpected)
    );
    const applicantPipelineBase = Math.max(
      1,
      stats.pendingApprovalsForChapter +
        stats.chapterAdjudicationCount +
        stats.chapterWinnersCount +
        stats.notAdvancingCount
    );
    const inviteBase = Math.max(
      1,
      Math.max(
        stats.invitesSent,
        stats.pendingInvites + stats.acceptedInvites + stats.expiredInvites
      )
    );
    const judgeCoverage = percentage(
      stats.judgesWithActivity,
      Math.max(1, stats.chapterJudgeCount)
    );
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>{chapterDashboardTitle}</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.chairKpiStrip}>
          <Link href="/dashboard/applications" className={styles.chairKpiLink}>
            <span className={styles.chairKpiLabel}>Applicants</span>
            <span className={styles.chairKpiValue}>{stats.totalApplicantsForChapter}</span>
            <span className={styles.chairKpiSub}>{stats.chapterName ?? "No chapter assigned"}</span>
          </Link>
          <Link href="/dashboard/users" className={styles.chairKpiLink}>
            <span className={styles.chairKpiLabel}>Judges</span>
            <span className={styles.chairKpiValue}>{stats.chapterJudgeCount}</span>
            <span className={styles.chairKpiSub}>{stats.judgesWithActivity} active</span>
          </Link>
          <Link href="/dashboard/users" className={styles.chairKpiLink}>
            <span className={styles.chairKpiLabel}>Invites</span>
            <span className={styles.chairKpiValue}>{stats.invitesSent}</span>
            <span className={styles.chairKpiSub}>{stats.pendingInvites} pending</span>
          </Link>
          <Link
            href="/dashboard/applications?status=APPROVED_FOR_CHAPTER_ADJUDICATION"
            className={styles.chairKpiLink}
          >
            <span className={styles.chairKpiLabel}>Scoring</span>
            <span className={styles.chairKpiValue}>{chapterScoreCompletion}%</span>
            <span className={styles.chairKpiSub}>{stats.scorecardsFinalized}/{Math.max(1, stats.scorecardsExpected)} finalized</span>
          </Link>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Chapter Snapshot</h2>
            <div className={styles.chairVisualGrid}>
              <article className={`${styles.chairVisualCard} ${styles.chairVisualCardPipeline}`}>
                <p className={styles.chairVisualTitle}>Applicant Pipeline</p>
                <div className={styles.analyticsRows}>
                  {[
                    {
                      label: "Pending",
                      value: stats.pendingApprovalsForChapter,
                      href: "/dashboard/applications?status=PENDING_APPROVAL",
                    },
                    {
                      label: "Adjudication",
                      value: stats.chapterAdjudicationCount,
                      href: "/dashboard/applications?status=APPROVED_FOR_CHAPTER_ADJUDICATION",
                    },
                    {
                      label: "Advanced",
                      value: stats.chapterWinnersCount,
                      href: "/dashboard/applications?status=PENDING_NATIONAL_ACCEPTANCE",
                    },
                    {
                      label: "Not Advancing",
                      value: stats.notAdvancingCount,
                      href: "/dashboard/applications?status=DID_NOT_ADVANCE",
                    },
                  ].map((item) => (
                    <Link key={item.label} href={item.href} className={styles.analyticsRowLink}>
                      <div className={styles.analyticsRow}>
                        <div className={styles.analyticsRowLabel}>{item.label}</div>
                        <div className={styles.analyticsBarWrap}>
                          <div
                            className={styles.analyticsBar}
                            style={{
                              width: `${percentage(item.value, applicantPipelineBase)}%`,
                            }}
                          />
                        </div>
                        <div className={styles.analyticsValue}>{item.value}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </article>

              <article className={`${styles.chairVisualCard} ${styles.chairVisualCardScoring}`}>
                <p className={styles.chairVisualTitle}>Scoring Completion</p>
                <p className={styles.chairVisualMetric}>{chapterScoreCompletion}%</p>
                <p className={styles.chairVisualMeta}>
                  {stats.scorecardsFinalized}/{Math.max(1, stats.scorecardsExpected)} finalized
                </p>
                <div className={styles.chairTrack}>
                  <div
                    className={styles.chairFill}
                    style={{ width: `${chapterScoreCompletion}%` }}
                  />
                </div>
                <div className={styles.chairMiniGrid}>
                  <div className={styles.chairMiniItem}>
                    <span>Draft</span>
                    <strong>{stats.scorecardsDraft}</strong>
                  </div>
                  <div className={styles.chairMiniItem}>
                    <span>Scores Entered</span>
                    <strong>{stats.scoreEntryCount}</strong>
                  </div>
                </div>
              </article>

              <article className={`${styles.chairVisualCard} ${styles.chairVisualCardInvites}`}>
                <p className={styles.chairVisualTitle}>Invitations</p>
                <div className={styles.analyticsRows}>
                  {[
                    { label: "Pending", value: stats.pendingInvites },
                    { label: "Accepted", value: stats.acceptedInvites },
                    { label: "Expired", value: stats.expiredInvites },
                  ].map((item) => (
                    <Link key={item.label} href="/dashboard/users" className={styles.analyticsRowLink}>
                      <div className={styles.analyticsRow}>
                        <div className={styles.analyticsRowLabel}>{item.label}</div>
                        <div className={styles.analyticsBarWrap}>
                          <div
                            className={styles.analyticsBar}
                            style={{ width: `${percentage(item.value, inviteBase)}%` }}
                          />
                        </div>
                        <div className={styles.analyticsValue}>{item.value}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </article>

              <article className={`${styles.chairVisualCard} ${styles.chairVisualCardJudges}`}>
                <p className={styles.chairVisualTitle}>Judge Activity</p>
                <p className={styles.chairVisualMetric}>{judgeCoverage}%</p>
                <p className={styles.chairVisualMeta}>
                  {stats.judgesWithActivity}/{Math.max(1, stats.chapterJudgeCount)} judges with scoring activity
                </p>
                <div className={styles.chairTrack}>
                  <div
                    className={styles.chairFill}
                    style={{ width: `${judgeCoverage}%` }}
                  />
                </div>
                <div className={styles.chairMiniGrid}>
                  <div className={styles.chairMiniItem}>
                    <span>Pending Approval</span>
                    <strong>{stats.pendingApprovalsForChapter}</strong>
                  </div>
                  <div className={styles.chairMiniItem}>
                    <span>Ready To Judge</span>
                    <strong>{stats.chapterAdjudicationCount}</strong>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Pending Approval (My Chapter)</h2>
            {stats.recentPendingApprovals.length === 0 ? (
              <p className={styles.muted}>No pending approvals in your chapter right now.</p>
            ) : (
              stats.recentPendingApprovals.map((app) => {
                const meta = parseApplicationMetadata(app.notes);
                return (
                  <article className={styles.row} key={app.id}>
                    <div className={styles.rowMain}>
                      <div className={styles.rowAvatar}>
                        <img
                          src={getDisplayHeadshot(app.headshot, app.id)}
                          alt={`${app.applicant.name} headshot`}
                          className={styles.rowAvatarImage}
                          loading="lazy"
                        />
                      </div>
                      <Link href={`/dashboard/applications/${app.id}`} className={styles.rowTitle}>
                        {app.applicant.name}
                      </Link>
                      <p className={styles.rowMeta}>
                        {meta.voicePart ? `${meta.voicePart} · ` : ""}
                        {app.event.name}
                      </p>
                    </div>
                    <Link href={`/dashboard/applications/${app.id}`} className={styles.rowLink}>
                      View
                    </Link>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Quick Links</h2>
          <div className={styles.quickLinks}>
            <QuickLink href="/dashboard/applications" label="Applications" />
          </div>
        </section>
      </div>
    );
  }

  if (hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    const stats = await getJudgeDashboardStats(
      user.id,
      user.organizationId,
      user.role,
      user.chapter
    );

    const remaining =
      stats.totalToJudgeCurrentRound - stats.completedByJudgeCurrentRound;
    const ctaLabel = "Open Judging List";
    const judgeRoleLabel =
      user.role === "CHAPTER_JUDGE" ? "Chapter Judge" : "National Judge";
    const judgeDashboardTitle =
      user.role === "CHAPTER_JUDGE"
        ? `${user.chapter?.trim() || "Unassigned"} ${judgeRoleLabel} Dashboard`
        : "National Judge Dashboard";
    const activeDivisionRows = stats.divisionSummary.filter(
      (row: { key: string; toJudge: number }) =>
        row.key !== "UNASSIGNED" && row.toJudge > 0
    );
    const ctaHref =
      activeDivisionRows.length === 1
        ? `/dashboard/scoring?division=${activeDivisionRows[0].key}`
        : "/dashboard/scoring";
    const visibleDivisionRows = stats.divisionSummary.filter(
      (row: { key: string; toJudge: number }) =>
        row.key !== "UNASSIGNED" || row.toJudge > 0
    );
    const completionPct = percentage(
      stats.completedByJudgeCurrentRound,
      Math.max(1, stats.totalToJudgeCurrentRound)
    );
    const countdown = getCountdownState(JUDGING_DEADLINE);
    const deadlineLabel = formatDeadline(JUDGING_DEADLINE);

    if (user.role === "CHAPTER_JUDGE") {
      const chapterDivisionRows = visibleDivisionRows.filter(
        (row: { key: string }) => row.key !== "UNASSIGNED"
      );

      return (
        <div className={styles.page}>
          <header className={`${styles.header} ${styles.judgeHeader}`}>
            <div className={styles.judgeHeaderLeft}>
              <div className={styles.titleRow}>
                <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
              </div>
              <h1 className={styles.title}>{judgeDashboardTitle}</h1>
            </div>
            {countdown && deadlineLabel ? (
              <div
                className={`${styles.countdownPill} ${styles.countdownCorner} ${styles[`countdownPill${countdown.tone}`]}`}
              >
                <span className={styles.countdownLabel}>{countdown.label}</span>
                <span className={styles.countdownDetail}>{countdown.detail}</span>
                <span className={styles.countdownSub}>Due {deadlineLabel}</span>
              </div>
            ) : null}
          </header>

          <section className={`${styles.judgeCtaCard} ${styles.judgeGoCard}`}>
            <p className={styles.judgeCtaLabel}>Ready To Judge</p>
            <Link href={ctaHref} className={`${styles.judgeCtaButton} ${styles.judgeGoButton}`}>
              {ctaLabel}
            </Link>
            <p className={styles.judgeCtaHint}>
              Opens your judging list for {stats.currentRoundLabel.toLowerCase()}.
            </p>
          </section>

          <section className={styles.sectionCard}>
            <div className={styles.sectionTopBar} />
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>Division Progress</h2>
              <div className={styles.analyticsRows}>
                {chapterDivisionRows.length === 0 ? (
                  <p className={styles.muted}>No division assignments yet.</p>
                ) : (
                  chapterDivisionRows.map(
                    (row: {
                      key: string;
                      label: string;
                      toJudge: number;
                      completed: number;
                    }) => (
                      <Link
                        key={row.key}
                        href={`/dashboard/scoring?division=${row.key}`}
                        className={styles.analyticsRowLink}
                      >
                        <div className={styles.analyticsRow}>
                          <div className={styles.analyticsRowLabel}>{row.label}</div>
                          <div className={styles.analyticsBarWrap}>
                            <div
                              className={styles.analyticsBar}
                              style={{
                                width: `${percentage(
                                  row.completed,
                                  Math.max(1, row.toJudge)
                                )}%`,
                              }}
                            />
                          </div>
                          <div className={styles.analyticsValue}>
                            {row.completed}/{row.toJudge}
                          </div>
                        </div>
                      </Link>
                    )
                  )
                )}
              </div>
            </div>
          </section>

          <section className={styles.grid4}>
            <StatCard
              title="Assigned To You"
              value={stats.totalToJudgeCurrentRound}
              sub={stats.currentRoundLabel}
              href="/dashboard/scoring"
            />
            <StatCard
              title="Completed"
              value={stats.completedByJudgeCurrentRound}
              sub={`${remaining} remaining`}
              href="/dashboard/scoring"
            />
            <StatCard
              title="Remaining"
              value={remaining}
              sub="not yet scored by you"
              href="/dashboard/scoring"
            />
            <StatCard
              title="Completion"
              value={`${completionPct}%`}
              sub={`${stats.completedByJudgeCurrentRound} of ${stats.totalToJudgeCurrentRound}`}
              href="/dashboard/scoring"
            />
          </section>

          <section>
            <h2 className={styles.sectionTitle}>Quick Links</h2>
            <div className={styles.quickLinks}>
              <QuickLink href="/dashboard/scoring" label="My Judging List" />
              <QuickLink href="/dashboard/notifications" label="Notifications" />
              <QuickLink href="/dashboard/support" label="Support" />
            </div>
          </section>
        </div>
      );
    }

    return (
      <div className={styles.page}>
        <header className={`${styles.header} ${styles.judgeHeader}`}>
          <div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{judgeDashboardTitle}</h1>
              <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
            </div>
            <p className={styles.muted}>Welcome {user.name}!</p>
          </div>
          {countdown && deadlineLabel ? (
            <div className={`${styles.countdownPill} ${styles[`countdownPill${countdown.tone}`]}`}>
              <span className={styles.countdownLabel}>{countdown.label}</span>
              <span className={styles.countdownDetail}>{countdown.detail}</span>
              <span className={styles.countdownSub}>Due {deadlineLabel}</span>
            </div>
          ) : null}
        </header>

        <section className={`${styles.judgeCtaCard} ${styles.judgeGoCard}`}>
          <p className={styles.judgeCtaLabel}>Ready To Judge</p>
          <Link href={ctaHref} className={`${styles.judgeCtaButton} ${styles.judgeGoButton}`}>
            {ctaLabel}
          </Link>
          <p className={styles.judgeCtaHint}>
            Opens your judging list for {stats.currentRoundLabel.toLowerCase()}.
          </p>
        </section>

        {user.role === "NATIONAL_JUDGE" ? (
          <section className={styles.sectionCard}>
            <div className={styles.sectionTopBar} />
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>National Finalists</h2>
              {stats.nationalFinalists.length === 0 ? (
                <p className={styles.muted}>
                  No national finalists are currently loaded into the national judging pool.
                </p>
              ) : (
                stats.nationalFinalists.map(
                  (finalist: {
                    id: string;
                    applicantName: string;
                    chapter: string;
                    division: string;
                    status: string;
                  }) => (
                    <article className={styles.row} key={finalist.id}>
                      <div className={styles.rowMain}>
                        <Link
                          href={`/dashboard/scoring/${finalist.id}`}
                          className={styles.rowTitle}
                        >
                          {finalist.applicantName}
                        </Link>
                        <p className={styles.rowMeta}>
                          {finalist.chapter} · {formatStatus(finalist.division)} ·{" "}
                          {formatStatus(finalist.status)}
                        </p>
                      </div>
                      <Link
                        href={`/dashboard/scoring/${finalist.id}`}
                        className={styles.rowLink}
                      >
                        Score
                      </Link>
                    </article>
                  )
                )
              )}
            </div>
          </section>
        ) : null}

        <section className={styles.grid3}>
          <StatCard
            title="Current Round"
            value="National"
            sub={stats.currentRoundLabel}
          />
          <StatCard
            title="To Judge"
            value={stats.totalToJudgeCurrentRound}
            href="/dashboard/scoring"
          />
          <StatCard
            title="Completed By You"
            value={stats.completedByJudgeCurrentRound}
            sub={`${remaining} remaining`}
            href="/dashboard/scoring"
          />
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Division Analytics</h2>
            <div className={styles.grid3}>
              {visibleDivisionRows.map(
                (row: {
                  key: string;
                  label: string;
                  toJudge: number;
                  completed: number;
                }) => (
                  <StatCard
                    key={row.key}
                    title={row.label}
                    value={row.toJudge}
                    sub={`${row.completed} completed`}
                    href={
                      row.key === "UNASSIGNED"
                        ? "/dashboard/scoring"
                        : `/dashboard/scoring?division=${row.key}`
                    }
                  />
                )
              )}
            </div>
          </div>
        </section>

        {stats.totalToJudgeCurrentRound === 0 ? (
          <section className={styles.sectionCard}>
            <div className={styles.sectionTopBar} />
            <div className={styles.sectionBody}>
              <h2 className={styles.sectionTitle}>
                {user.role === "NATIONAL_JUDGE" ? "National Queue Status" : "Queue Status"}
              </h2>
              <p className={styles.muted}>
                {user.role === "NATIONAL_JUDGE"
                  ? "No applications are ready for national judging yet. National judges only see finalists after they have been moved into the national judging pool."
                  : "No applications are ready for chapter judging yet."}
              </p>
            </div>
          </section>
        ) : null}

        <section>
          <h2 className={styles.sectionTitle}>Quick Links</h2>
          <div className={styles.quickLinks}>
            <QuickLink href="/dashboard/scoring" label="My Judging List" />
            <QuickLink href="/dashboard/notifications" label="Notifications" />
          </div>
        </section>
      </div>
    );
  }

  if (hasRole(session, "APPLICANT")) {
    const stats = await getApplicantDashboardStats(user.id, user.organizationId);

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.welcome}>Welcome, {user.name}</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.grid4}>
          <StatCard title="My Applications" value={stats.applicationCount} />
          <StatCard title="Open Events" value={stats.openEvents} sub="accepting applications" />
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>My Applications</h2>
            {stats.myApplications.length === 0 ? (
              <p className={styles.muted}>No applications yet.</p>
            ) : (
              stats.myApplications.map((app) => (
                <article className={styles.row} key={app.id}>
                  <div>
                    <p className={styles.rowTitle}>{app.event.name}</p>
                    <p className={styles.rowMeta}>{formatStatus(app.status)}</p>
                  </div>
                  <Link href={`/dashboard/applications/${app.id}`} className={styles.rowLink}>
                    View
                  </Link>
                </article>
              ))
            )}
          </div>
        </section>

        {stats.openEvents > 0 ? (
          <section>
            <h2 className={styles.sectionTitle}>Quick Links</h2>
            <div className={styles.quickLinks}>
              <QuickLink href="/dashboard/applications" label="My Applications" />
            </div>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <section className={styles.centerCard}>
      <h1 className={styles.title}>Welcome back, {user.name}</h1>
      <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
      <p className={styles.muted}>Your dashboard is being prepared for this role.</p>
    </section>
  );
}
