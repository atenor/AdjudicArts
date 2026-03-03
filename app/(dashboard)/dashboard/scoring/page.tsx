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
import {
  ApplicationDivision,
  formatDivisionLabel,
} from "@/lib/application-division";
import { getDisplayHeadshot } from "@/lib/headshots";
import HeadshotPreview from "@/components/shared/headshot-preview";

export default async function ScoringQueuePage({
  searchParams,
}: {
  searchParams: {
    view?: string;
    division?: string;
    voicePart?: string;
    sort?: string;
    bookmarks?: string;
    layout?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    redirect("/dashboard");
  }

  const requestedDivision: ApplicationDivision | undefined =
    searchParams.division === "16-18" || searchParams.division === "19-22"
      ? searchParams.division
      : undefined;

  const queue = await getJudgeScoringQueue(
    session.user.id,
    session.user.organizationId,
    session.user.role,
    { userChapter: session.user.chapter }
  );

  const view = searchParams.view === "compact" ? "compact" : "detailed";
  const selectedVoicePart = searchParams.voicePart?.trim() || "";
  const sort = (() => {
    switch (searchParams.sort) {
      case "name":
      case "voice-part":
      case "chapter":
      case "bookmarked":
        return searchParams.sort;
      default:
        return "submitted";
    }
  })();
  const bookmarksOnly = searchParams.bookmarks === "only";
  const layout = searchParams.layout === "combined" ? "combined" : "grouped";

  const availableVoiceParts = Array.from(
    new Set(
      queue.flatMap((roundQueue) =>
        roundQueue.applications
          .map((application) => application.voicePart?.trim() || "")
          .filter((voicePart) => voicePart.length > 0)
      )
    )
  ).sort((left, right) => left.localeCompare(right));

  const filteredQueue = queue
    .map((roundQueue) => {
      const applications = roundQueue.applications
        .filter((application) =>
          !requestedDivision || application.division === requestedDivision
        )
        .filter((application) =>
          !selectedVoicePart ||
          (application.voicePart?.trim().toLowerCase() ?? "") ===
            selectedVoicePart.toLowerCase()
        )
        .filter((application) => !bookmarksOnly || application.isBookmarked)
        .slice()
        .sort((left, right) => {
          if (sort === "bookmarked") {
            if (left.isBookmarked !== right.isBookmarked) {
              return left.isBookmarked ? -1 : 1;
            }
          }

          if (sort === "name") {
            return left.applicant.name.localeCompare(right.applicant.name);
          }
          if (sort === "voice-part") {
            return (left.voicePart ?? "~").localeCompare(right.voicePart ?? "~") ||
              left.applicant.name.localeCompare(right.applicant.name);
          }
          if (sort === "chapter") {
            return (left.chapter ?? "~").localeCompare(right.chapter ?? "~") ||
              left.applicant.name.localeCompare(right.applicant.name);
          }

          return (
            left.submittedAt.getTime() - right.submittedAt.getTime() ||
            left.applicant.name.localeCompare(right.applicant.name)
          );
        });

      return {
        ...roundQueue,
        applications,
        totalCount: applications.length,
        scoredCount: applications.filter((application) => application.isScored).length,
      };
    })
    .filter((roundQueue) => roundQueue.applications.length > 0 || Boolean(roundQueue.blockedReason));

  const totalApplications = filteredQueue.reduce((sum, round) => sum + round.totalCount, 0);
  const totalScored = filteredQueue.reduce((sum, round) => sum + round.scoredCount, 0);

  function buildQueueHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const nextView = overrides.view ?? view;
    const nextDivision =
      Object.prototype.hasOwnProperty.call(overrides, "division")
        ? overrides.division
        : requestedDivision;
    const nextVoicePart =
      Object.prototype.hasOwnProperty.call(overrides, "voicePart")
        ? overrides.voicePart
        : selectedVoicePart || undefined;
    const nextSort =
      Object.prototype.hasOwnProperty.call(overrides, "sort")
        ? overrides.sort
        : sort;
    const nextBookmarks =
      Object.prototype.hasOwnProperty.call(overrides, "bookmarks")
        ? overrides.bookmarks
        : bookmarksOnly
          ? "only"
          : undefined;
    const nextLayout =
      Object.prototype.hasOwnProperty.call(overrides, "layout")
        ? overrides.layout
        : layout;

    if (nextView && nextView !== "detailed") params.set("view", nextView);
    if (nextDivision) params.set("division", nextDivision);
    if (nextVoicePart) params.set("voicePart", nextVoicePart);
    if (nextSort && nextSort !== "submitted") params.set("sort", nextSort);
    if (nextBookmarks === "only") params.set("bookmarks", "only");
    if (nextLayout && nextLayout !== "grouped") params.set("layout", nextLayout);

    const query = params.toString();
    return query ? `/dashboard/scoring?${query}` : "/dashboard/scoring";
  }

  function buildDetailHref(applicationId: string) {
    const params = new URLSearchParams();
    if (requestedDivision) params.set("division", requestedDivision);
    const query = params.toString();
    return query
      ? `/dashboard/scoring/${applicationId}?${query}`
      : `/dashboard/scoring/${applicationId}`;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Judging List</h1>
        <p className="text-sm text-muted-foreground">
          {totalScored} of {totalApplications} judge submissions finalized
        </p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Division:</span>
          <Link
            href={buildQueueHref({ division: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !requestedDivision
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            All
          </Link>
          {(["16-18", "19-22"] as const).map((division) => (
            <Link
              key={division}
              href={buildQueueHref({ division })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                requestedDivision === division
                  ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {formatDivisionLabel(division)}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">View:</span>
          <Link
            href={buildQueueHref({ view: "detailed" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "detailed"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Detailed
          </Link>
          <Link
            href={buildQueueHref({ view: "compact" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              view === "compact"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Compact
          </Link>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Layout:</span>
          <Link
            href={buildQueueHref({ layout: "grouped" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              layout === "grouped"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Grouped by division
          </Link>
          <Link
            href={buildQueueHref({ layout: "combined" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              layout === "combined"
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Combined list
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Sort:</span>
          {[
            ["submitted", "Submission order"],
            ["bookmarked", "Bookmarked first"],
            ["voice-part", "Voice part"],
            ["chapter", "Chapter"],
            ["name", "Applicant name"],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={buildQueueHref({ sort: value })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                sort === value
                  ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Voice part:</span>
          <Link
            href={buildQueueHref({ voicePart: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !selectedVoicePart
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            All
          </Link>
          {availableVoiceParts.map((voicePart) => (
            <Link
              key={voicePart}
              href={buildQueueHref({ voicePart })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                selectedVoicePart === voicePart
                  ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                  : "border-border bg-background text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {voicePart}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-sm text-muted-foreground">Bookmarks:</span>
          <Link
            href={buildQueueHref({ bookmarks: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !bookmarksOnly
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            All applicants
          </Link>
          <Link
            href={buildQueueHref({ bookmarks: "only" })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              bookmarksOnly
                ? "border-[#5f2ec8] bg-[#ede6f7] text-[#4a2e82]"
                : "border-border bg-background text-muted-foreground hover:bg-muted/40"
            }`}
          >
            Bookmarked only
          </Link>
        </div>
      </div>

      {filteredQueue.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No assigned applications match the current judging filters.
        </p>
      ) : (
        <div className="space-y-6">
          {filteredQueue.map((roundQueue) => (
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
                  {roundQueue.blockedReason ?? "No applications are currently in this adjudication stage."}
                </p>
              ) : (
                (() => {
                  if (layout === "combined") {
                    return (
                      <article className="rounded-lg border">
                        <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                          <p className="text-sm font-semibold">Combined applicant list</p>
                          <span className="text-xs text-muted-foreground">
                            {roundQueue.applications.length} applicant
                            {roundQueue.applications.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="divide-y">
                          {roundQueue.applications.map((application) => (
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
                                    href={buildDetailHref(application.id)}
                                    className="truncate text-sm font-semibold hover:underline"
                                  >
                                    {application.applicant.name}
                                  </Link>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {[application.division ?? "Unassigned division", application.voicePart ?? "No voice part", application.chapter || "No chapter"]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {application.isBookmarked ? (
                                  <Badge variant="outline">Bookmarked</Badge>
                                ) : null}
                                {view === "detailed" ? (
                                  <ApplicationStatusBadge status={application.status} />
                                ) : null}
                                {application.submissionStatus === "FINALIZED" ? (
                                  <Badge variant="default">Finalized</Badge>
                                ) : application.hasAllCriteria ? (
                                  <Badge variant="outline">Draft Saved</Badge>
                                ) : (
                                  <Badge variant="secondary">Draft Incomplete</Badge>
                                )}
                                <Link
                                  href={buildDetailHref(application.id)}
                                  className="rounded-md border border-[#cfc3e3] px-2 py-1 text-xs font-medium text-[#5f4d87] hover:bg-[#f4effb]"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  }

                  const byDivision = roundQueue.applications.reduce<
                    Record<string, typeof roundQueue.applications>
                  >((groups, application) => {
                    const key = application.division ?? "UNASSIGNED";
                    if (!groups[key]) groups[key] = [];
                    groups[key].push(application);
                    return groups;
                  }, {});

                  return (
                    <div className="space-y-3">
                      {Object.entries(byDivision).map(([division, applications]) => (
                        <article key={`${roundQueue.round.id}-${division}`} className="rounded-lg border">
                          <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                            <p className="text-sm font-semibold">
                              {division === "UNASSIGNED"
                                ? "Division Unassigned"
                                : formatDivisionLabel(division as ApplicationDivision)}
                            </p>
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
                                      href={buildDetailHref(application.id)}
                                      className="truncate text-sm font-semibold hover:underline"
                                    >
                                      {application.applicant.name}
                                    </Link>
                                    {view === "detailed" ? (
                                      <p className="truncate text-xs text-muted-foreground">
                                        {[application.voicePart ?? "No voice part", application.chapter || "No chapter"]
                                          .filter(Boolean)
                                          .join(" · ")}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {application.isBookmarked ? (
                                    <Badge variant="outline">Bookmarked</Badge>
                                  ) : null}
                                  {view === "detailed" ? (
                                    <ApplicationStatusBadge status={application.status} />
                                  ) : null}
                                  {application.submissionStatus === "FINALIZED" ? (
                                    <Badge variant="default">Finalized</Badge>
                                  ) : application.hasAllCriteria ? (
                                    <Badge variant="outline">Draft Saved</Badge>
                                  ) : (
                                    <Badge variant="secondary">Draft Incomplete</Badge>
                                  )}
                                  <Link
                                    href={buildDetailHref(application.id)}
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
