export const dynamic = 'force-dynamic';

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const metadata: Metadata = { title: "Dashboard" };
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { ROLE_LABELS, ROLE_BADGE_VARIANTS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAdminDashboardStats,
  getChapterChairDashboardStats,
  getJudgeDashboardStats,
  getApplicantDashboardStats,
} from "@/lib/db/dashboard";
import { parseApplicationMetadata } from "@/lib/application-metadata";

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      {label}
    </Link>
  );
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { user } = session;

  // ---------------------------------------------------------------------------
  // ADMIN / NATIONAL_CHAIR
  // ---------------------------------------------------------------------------
  if (hasRole(session, "ADMIN", "NATIONAL_CHAIR")) {
    const stats = await getAdminDashboardStats(user.organizationId);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard title="Total Events" value={stats.totalEvents} />
          <StatCard
            title="Active Events"
            value={stats.openEvents}
            sub="open, review, or judging"
          />
          <StatCard title="Total Applications" value={stats.totalApplications} />
          <StatCard
            title="Pending Review"
            value={stats.pendingApplications}
            sub="awaiting scoring or decision"
          />
        </div>

        {/* Recent applications */}
        {stats.recentApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.recentApplications.map((app) => {
                const meta = parseApplicationMetadata(app.notes);
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">
                        {app.applicant.name}
                      </span>
                      {meta.voicePart && (
                        <span className="text-muted-foreground hidden sm:inline">
                          — {meta.voicePart}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground hidden md:inline">
                        {app.event.name}
                      </span>
                      <Link
                        href={`/dashboard/applications/${app.id}`}
                        className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Quick links */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Quick Links
          </p>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/dashboard/events" label="Events" />
            <QuickLink href="/dashboard/applications" label="Applications" />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CHAPTER_CHAIR
  // ---------------------------------------------------------------------------
  if (hasRole(session, "CHAPTER_CHAIR")) {
    const stats = await getChapterChairDashboardStats(user.organizationId);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="Events in Chapter Review"
            value={stats.eventsInChapterReview}
          />
          <StatCard
            title="Applications to Review"
            value={stats.applicationsInReview}
            sub="currently at chapter review stage"
          />
        </div>

        {stats.recentApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Applications Pending Review
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.recentApplications.map((app) => {
                const meta = parseApplicationMetadata(app.notes);
                return (
                  <div
                    key={app.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">
                        {app.applicant.name}
                      </span>
                      {meta.voicePart && (
                        <span className="text-muted-foreground hidden sm:inline">
                          — {meta.voicePart}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/applications/${app.id}`}
                      className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground shrink-0"
                    >
                      View
                    </Link>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Quick Links
          </p>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/dashboard/applications" label="Applications" />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CHAPTER_JUDGE / NATIONAL_JUDGE
  // ---------------------------------------------------------------------------
  if (hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    const stats = await getJudgeDashboardStats(
      user.id,
      user.organizationId,
      user.role
    );

    const remaining = stats.totalToScore - stats.totalScored;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Assigned Rounds" value={stats.roundCount} />
          <StatCard
            title="Applications Scored"
            value={stats.totalScored}
            sub={`of ${stats.totalToScore} total`}
          />
          <StatCard
            title="Remaining"
            value={remaining}
            sub={remaining === 0 ? "all complete!" : "to score"}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Quick Links
          </p>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/dashboard/scoring" label="My Scoring Queue" />
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // APPLICANT
  // ---------------------------------------------------------------------------
  if (hasRole(session, "APPLICANT")) {
    const stats = await getApplicantDashboardStats(
      user.id,
      user.organizationId
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            Welcome, {user.name}
          </h1>
          <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            title="My Applications"
            value={stats.applicationCount}
          />
          <StatCard
            title="Open Events"
            value={stats.openEvents}
            sub="accepting applications"
          />
        </div>

        {stats.myApplications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.myApplications.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium truncate block">
                      {app.event.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatStatus(app.status)}
                    </span>
                  </div>
                  <Link
                    href={`/dashboard/applications/${app.id}`}
                    className="text-xs underline underline-offset-2 hover:text-foreground text-muted-foreground shrink-0 ml-4"
                  >
                    View
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {stats.openEvents > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Quick Links
            </p>
            <div className="flex flex-wrap gap-2">
              <QuickLink href="/dashboard/applications" label="My Applications" />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Fallback for any other role
  return (
    <div className="flex items-center justify-center pt-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back, {user.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant={ROLE_BADGE_VARIANTS[user.role]}>
            {ROLE_LABELS[user.role]}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
