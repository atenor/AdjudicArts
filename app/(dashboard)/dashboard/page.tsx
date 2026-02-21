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
import styles from "./dashboard.module.css";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string | number;
  sub?: string;
}) {
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

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { user } = session;

  if (hasRole(session, "ADMIN", "NATIONAL_CHAIR")) {
    const stats = await getAdminDashboardStats(user.organizationId);

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Admin Dashboard</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.grid4}>
          <StatCard title="Applications" value={stats.totalApplications} />
          <StatCard title="Events" value={stats.totalEvents} />
          <StatCard title="Active" value={stats.openEvents} sub="open, review, or judging" />
          <StatCard
            title="Pending Review"
            value={stats.pendingApplications}
            sub="awaiting scoring or decision"
          />
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
                    <div>
                      <p className={styles.rowTitle}>{app.applicant.name}</p>
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
    const stats = await getChapterChairDashboardStats(user.organizationId);

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Chapter Dashboard</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.grid4}>
          <StatCard title="Events in Review" value={stats.eventsInChapterReview} />
          <StatCard
            title="Applications"
            value={stats.applicationsInReview}
            sub="currently at chapter review stage"
          />
        </section>

        <section className={styles.sectionCard}>
          <div className={styles.sectionTopBar} />
          <div className={styles.sectionBody}>
            <h2 className={styles.sectionTitle}>Pending Review</h2>
            {stats.recentApplications.length === 0 ? (
              <p className={styles.muted}>No applications in chapter review right now.</p>
            ) : (
              stats.recentApplications.map((app) => {
                const meta = parseApplicationMetadata(app.notes);
                return (
                  <article className={styles.row} key={app.id}>
                    <div>
                      <p className={styles.rowTitle}>{app.applicant.name}</p>
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
      user.role
    );

    const remaining = stats.totalToScore - stats.totalScored;

    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>Judge Dashboard</h1>
          <span className={styles.rolePill}>{ROLE_LABELS[user.role]}</span>
        </header>

        <section className={styles.grid3}>
          <StatCard title="Rounds" value={stats.roundCount} />
          <StatCard title="Scored" value={stats.totalScored} sub={`of ${stats.totalToScore} total`} />
          <StatCard
            title="Remaining"
            value={remaining}
            sub={remaining === 0 ? "all complete" : "to score"}
          />
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Quick Links</h2>
          <div className={styles.quickLinks}>
            <QuickLink href="/dashboard/scoring" label="My Scoring Queue" />
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
