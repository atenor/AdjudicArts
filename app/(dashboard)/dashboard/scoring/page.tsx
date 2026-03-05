export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Judging List" };
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getJudgeScoringQueue } from "@/lib/db/scores";
import { Badge } from "@/components/ui/badge";
import {
  ApplicationDivision,
  formatDivisionLabel,
} from "@/lib/application-division";
import { getDisplayHeadshot } from "@/lib/headshots";
import HeadshotPreview from "@/components/shared/headshot-preview";
import ScoringFilters from "@/components/judging/scoring-filters";

function formatChapterLabel(chapter: string | null | undefined) {
  const trimmed = (chapter ?? "").trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/[–—]/g, "-");
  const parts = normalized.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const left = parts[0].toLowerCase().replace(/\s+chapter$/, "").trim();
    const right = parts[1].toLowerCase().replace(/\s+chapter$/, "").trim();
    if (left && right && left === right) {
      return `${parts[1].replace(/\s+chapter$/i, "").trim()} Chapter`;
    }
  }
  return trimmed;
}

function formatScoreDisplay(value: number | null | undefined) {
  if (typeof value !== "number") return "Score —";
  return `Score ${value.toFixed(1)}`;
}

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
  const isNationalJudge = session.user.role === "NATIONAL_JUDGE";

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

  const discoveredVoiceParts = Array.from(
    new Set(
      queue.flatMap((roundQueue) =>
        roundQueue.applications
          .map((application) => application.voicePart?.trim() || "")
          .filter((voicePart) => voicePart.length > 0)
      )
    )
  );
  const standardVoiceParts = [
    "Soprano",
    "Mezzo-Soprano",
    "Contralto",
    "Countertenor",
    "Tenor",
    "Baritone",
    "Bass",
    "Other",
  ];
  const orderedStandardVoiceParts = [...standardVoiceParts];
  const extraVoiceParts = discoveredVoiceParts
    .filter(
      (voicePart) =>
        !standardVoiceParts.some(
          (standardVoicePart) => standardVoicePart.toLowerCase() === voicePart.toLowerCase()
        )
    )
    .sort((left, right) => left.localeCompare(right));
  const availableVoiceParts = [...orderedStandardVoiceParts, ...extraVoiceParts];

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
  const hasActiveFilters =
    Boolean(requestedDivision) ||
    Boolean(selectedVoicePart) ||
    sort !== "submitted" ||
    bookmarksOnly ||
    layout !== "grouped" ||
    view !== "detailed";

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
        <h1 className="text-2xl font-semibold leading-tight">
          {isNationalJudge ? "National Judging Queue" : "Judging List"}
        </h1>
        <p className="mt-1 text-base font-medium text-[#6f6491]">
          {totalScored} of {totalApplications}{" "}
          {isNationalJudge ? "national" : "judge"} scorecards complete
        </p>
        {isNationalJudge ? (
          <p className="text-sm text-[#6f6491]">
            National judges see finalists after they have been moved into the national judging
            pool.
          </p>
        ) : null}
      </div>

      {filteredQueue.length === 0 ? (
        <div className="rounded-xl border border-[#d8cce9] bg-white px-4 py-4 shadow-sm">
          <p className="text-sm font-semibold text-[#1e1538]">
            {isNationalJudge && !hasActiveFilters
              ? "No applications are ready for national judging."
              : "No assigned applications match the current judging filters."}
          </p>
          <p className="mt-1 text-sm text-[#6f6491]">
            {isNationalJudge && !hasActiveFilters
              ? "Finalists will appear here after they are moved into the national judging pool."
              : "Try clearing one or more filters to see more assigned applicants."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredQueue.map((roundQueue, roundIndex) => (
            <section key={roundQueue.round.id} className="space-y-0.5">
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
                      <>
                        {roundIndex === 0 ? (
                          <div className="flex justify-end">
                            <ScoringFilters
                              hasActiveFilters={hasActiveFilters}
                              division={requestedDivision}
                              view={view}
                              layout={layout}
                              sort={sort}
                              voicePart={selectedVoicePart}
                              bookmarksOnly={bookmarksOnly}
                              availableVoiceParts={availableVoiceParts}
                            />
                          </div>
                        ) : null}
                        <article className="rounded-lg border">
                        <div className="flex items-center justify-between gap-2 border-b border-[#b79ddf] bg-[#ddd0f1] px-3 py-2">
                          <p className="text-sm font-semibold text-[#25174d]">Combined applicant list</p>
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
                                    {[application.division ?? "Unassigned division", application.voicePart, formatChapterLabel(application.chapter)]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {application.isBookmarked ? (
                                  <Badge variant="outline">Bookmarked</Badge>
                                ) : null}
                                <span className="rounded-full border border-[#d8cce9] bg-white px-2.5 py-1 text-xs font-semibold text-[#5f4d87]">
                                  {formatScoreDisplay(application.judgeScoreTotal)}
                                </span>
                                {application.hasAllCriteria ? (
                                  <span className="rounded-full border border-[#8fdcbf] bg-[#d6f6e8] px-3 py-1 text-xs font-semibold text-[#147a58]">
                                    Complete
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-[#f0cf74] bg-[#fff3cd] px-3 py-1 text-xs font-semibold text-[#856404]">
                                    Queued
                                  </span>
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
                      </>
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
                  const orderedDivisionKeys = ["16-18", "19-22", "UNASSIGNED"].filter(
                    (key) => Boolean(byDivision[key])
                  );

                  return (
                    <div className="space-y-3">
                      {orderedDivisionKeys.map((division) => {
                        const applications = byDivision[division];
                        return (
                        <div key={`${roundQueue.round.id}-${division}`} className="space-y-2">
                          {roundIndex === 0 && division === orderedDivisionKeys[0] ? (
                            <div className="flex justify-end -mt-3 mb-0.5">
                              <ScoringFilters
                                hasActiveFilters={hasActiveFilters}
                                division={requestedDivision}
                                view={view}
                                layout={layout}
                                sort={sort}
                                voicePart={selectedVoicePart}
                                bookmarksOnly={bookmarksOnly}
                                availableVoiceParts={availableVoiceParts}
                              />
                            </div>
                          ) : null}
                          <article className="rounded-lg border">
                            <div className="flex items-center justify-between gap-2 border-b border-[#b79ddf] bg-[#ddd0f1] px-3 py-2">
                              <p className="text-sm font-semibold text-[#25174d]">
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
                                      {view === "detailed" && (application.voicePart || application.chapter) ? (
                                        <p className="truncate text-xs text-muted-foreground">
                                          {[application.voicePart, formatChapterLabel(application.chapter)]
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
                                    <span className="rounded-full border border-[#d8cce9] bg-white px-2.5 py-1 text-xs font-semibold text-[#5f4d87]">
                                      {formatScoreDisplay(application.judgeScoreTotal)}
                                    </span>
                                    {application.hasAllCriteria ? (
                                      <span className="rounded-full border border-[#8fdcbf] bg-[#d6f6e8] px-3 py-1 text-xs font-semibold text-[#147a58]">
                                        Complete
                                      </span>
                                    ) : (
                                      <span className="rounded-full border border-[#f0cf74] bg-[#fff3cd] px-3 py-1 text-xs font-semibold text-[#856404]">
                                        Queued
                                      </span>
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
                        </div>
                        );
                      })}
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
