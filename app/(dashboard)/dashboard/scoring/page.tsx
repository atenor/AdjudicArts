export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Judging List" };
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getJudgeScoringQueue } from "@/lib/db/scores";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import { Badge } from "@/components/ui/badge";
import { formatVoicePart } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import HeadshotPreview from "@/components/shared/headshot-preview";

export default async function ScoringQueuePage({
  searchParams,
}: {
  searchParams: { view?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    redirect("/dashboard");
  }

  const queue = await getJudgeScoringQueue(
    session.user.id,
    session.user.organizationId,
    session.user.role
  );

  const totalApplications = queue.reduce((sum, round) => sum + round.totalCount, 0);
  const totalScored = queue.reduce((sum, round) => sum + round.scoredCount, 0);
  const view = searchParams.view === "compact" ? "compact" : "detailed";

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Judging List</h1>
        <p className="text-sm text-muted-foreground">
          {totalScored} of {totalApplications} applications scored
        </p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">View:</span>
          <Link
            href="/dashboard/scoring?view=detailed"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "detailed"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Detailed
          </Link>
          <Link
            href="/dashboard/scoring?view=compact"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "compact"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Compact
          </Link>
        </div>
      </div>

      {queue.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assigned rounds are currently open for judging.
        </p>
      ) : (
        <div className="space-y-6">
          {queue.map((roundQueue) => (
            <section key={roundQueue.round.id} className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{roundQueue.round.name}</h2>
                <Badge variant="outline">
                  {roundQueue.round.type.toLowerCase()} round
                </Badge>
                <span className="text-sm text-muted-foreground sm:ml-1">
                  {roundQueue.event.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  ({roundQueue.scoredCount}/{roundQueue.totalCount} scored)
                </span>
              </div>

              {roundQueue.applications.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No applications are currently in this adjudication stage.
                </p>
              ) : (
                (() => {
                  const byDivision = roundQueue.applications.reduce<
                    Record<string, typeof roundQueue.applications>
                  >((groups, application) => {
                    const division = formatVoicePart(application.voicePart);
                    const key = division === "Not specified" ? "Unspecified" : division;
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(application);
                    return groups;
                  }, {});

                  return (
                    <div className="space-y-3">
                      {Object.entries(byDivision).map(([division, applications]) => (
                        <article key={`${roundQueue.round.id}-${division}`} className="rounded-lg border">
                          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                            <p className="text-sm font-semibold">{division} Division</p>
                            <span className="text-xs text-muted-foreground">
                              {applications.length} applicant{applications.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="divide-y">
                            {applications.map((application) => (
                              <div
                                key={application.id}
                                className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-muted/30"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <HeadshotPreview
                                    src={getDisplayHeadshot(application.headshot, application.id)}
                                    alt={`${application.applicant.name} headshot`}
                                    triggerClassName={
                                      view === "compact"
                                        ? "h-11 w-11 rounded-full object-cover border border-border/70 bg-muted"
                                        : "h-12 w-12 rounded-full object-cover border border-border/70 bg-muted"
                                    }
                                  />
                                  <div className="min-w-0">
                                    <Link
                                      href={`/dashboard/scoring/${application.id}`}
                                      className="truncate text-sm font-semibold hover:underline"
                                    >
                                      {application.applicant.name}
                                    </Link>
                                    {view === "detailed" ? (
                                      <p className="truncate text-xs text-muted-foreground">
                                        {application.chapter || "No chapter"}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {view === "detailed" ? (
                                    <ApplicationStatusBadge status={application.status} />
                                  ) : null}
                                  {application.isScored ? (
                                    <Badge variant="default">Scored</Badge>
                                  ) : (
                                    <Badge variant="secondary">Pending</Badge>
                                  )}
                                  <Link
                                    href={`/dashboard/scoring/${application.id}`}
                                    className="rounded-md border border-[#cfc3e3] px-2 py-1 text-xs font-medium text-[#5f4d87] hover:bg-[#f4effb]"
                                  >
                                    Open
                                  </Link>
                                </div>
                              </div>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  );
                })()
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
