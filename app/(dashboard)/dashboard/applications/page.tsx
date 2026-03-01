export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";

export const metadata: Metadata = { title: "Applications" };
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApplicationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import {
  getAllowedApplicationStatusesForRole,
  listApplicationChaptersByOrg,
  listApplicationsByOrg,
} from "@/lib/db/applications";
import { formatVoicePart } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import BatchApplicationsTable from "@/components/applications/batch-applications-table";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED_PENDING_APPROVAL: "Submitted — Pending Approval",
  CHAPTER_ADJUDICATION: "Chapter Adjudication",
  NATIONAL_FINALS: "National Finals",
  SUBMITTED: "Submitted — Pending Approval",
  CHAPTER_REVIEW: "Chapter Adjudication",
  CHAPTER_APPROVED: "Chapter Approved",
  CHAPTER_REJECTED: "Chapter Rejected",
  NATIONAL_REVIEW: "National Finals",
  NATIONAL_APPROVED: "National Approved",
  NATIONAL_REJECTED: "National Rejected",
  DECIDED: "Decided",
};

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function calculateAge(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null;
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = now.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatDivision(age: number | null) {
  if (age === null) return "Division —";
  if (age >= 16 && age <= 18) return "Division 16-18";
  if (age >= 19 && age <= 22) return "Division 19-22";
  return "Division —";
}

function wasForwardedBypass(notes: string | null | undefined) {
  if (!notes) return false;
  try {
    const parsed = JSON.parse(notes) as {
      auditHistory?: unknown[];
      chapterBypassForward?: { forwarded?: boolean };
    };
    if (parsed.chapterBypassForward?.forwarded) return true;
    if (!Array.isArray(parsed.auditHistory)) return false;
    return parsed.auditHistory.some((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const audit = entry as Record<string, unknown>;
      return audit.type === "FORWARDED_TO_NATIONALS_BYPASS_CHAPTER";
    });
  } catch {
    return false;
  }
}

function statusFilterClasses(status: ApplicationStatus | undefined, active: boolean) {
  if (!status) {
    return active
      ? "bg-[#e9f4ec] border-[#8eb89c] text-[#1f5b38]"
      : "bg-[#fffdf5] border-[#e5d8ab] text-[#6b5a23] hover:bg-[#f9f2da]";
  }

  if (status === "SUBMITTED_PENDING_APPROVAL" || status === "SUBMITTED") {
    return active
      ? "bg-[#fff3cf] border-[#d1ab3f] text-[#7a5c10]"
      : "bg-[#fffaf0] border-[#eadbb0] text-[#7a5c10] hover:bg-[#fff3dc]";
  }
  if (status === "CHAPTER_ADJUDICATION" || status === "CHAPTER_REVIEW") {
    return active
      ? "bg-[#e4efff] border-[#5b83d6] text-[#214f9b]"
      : "bg-[#f3f8ff] border-[#c8d9f7] text-[#305fae] hover:bg-[#e9f1ff]";
  }
  if (status === "NATIONAL_FINALS" || status === "NATIONAL_REVIEW") {
    return active
      ? "bg-[#efe8ff] border-[#7b5dc8] text-[#472d96]"
      : "bg-[#f7f2ff] border-[#d9ccf2] text-[#5b3eab] hover:bg-[#eee5ff]";
  }
  if (status === "CHAPTER_REJECTED" || status === "NATIONAL_REJECTED") {
    return active
      ? "bg-[#ffe6e6] border-[#dc6d6d] text-[#a22525]"
      : "bg-[#fff4f4] border-[#f0c6c6] text-[#a43b3b] hover:bg-[#ffeaea]";
  }
  if (status === "CHAPTER_APPROVED" || status === "NATIONAL_APPROVED" || status === "DECIDED") {
    return active
      ? "bg-[#ddf5e6] border-[#57ad7a] text-[#1f6a3d]"
      : "bg-[#f2fbf5] border-[#b7e3c8] text-[#2f7d4c] hover:bg-[#e8f7ee]";
  }

  return active
    ? "bg-[#e9f4ec] border-[#8eb89c] text-[#1f5b38]"
    : "bg-[#fffdf5] border-[#e5d8ab] text-[#6b5a23] hover:bg-[#f9f2da]";
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { status?: string; view?: string; chapter?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (
    !hasRole(
      session,
      "ADMIN",
      "NATIONAL_CHAIR",
      "CHAPTER_CHAIR"
    )
  ) {
    if (hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
      redirect("/dashboard/scoring");
    }
    redirect("/dashboard");
  }

  const statusOptions = getAllowedApplicationStatusesForRole(session.user.role);
  if (statusOptions.length === 0) redirect("/dashboard");

  const statusFilter =
    searchParams.status && statusOptions.includes(searchParams.status as ApplicationStatus)
      ? (searchParams.status as ApplicationStatus)
      : undefined;
  const activeStatusLabel = statusFilter ? STATUS_LABELS[statusFilter] : undefined;
  // Keep the first status per label so canonical workflow states win over legacy aliases.
  const visibleStatusOptions = statusOptions.filter((status, index, all) => {
    const label = STATUS_LABELS[status];
    return all.findIndex((candidate) => STATUS_LABELS[candidate] === label) === index;
  });
  const viewMode = searchParams.view === "list" ? "list" : "cards";
  const chapterFilter = searchParams.chapter?.trim() || undefined;
  const canFilterByChapter =
    session.user.role === "ADMIN" || session.user.role === "NATIONAL_CHAIR";

  function buildApplicationsHref(
    status?: ApplicationStatus,
    view = viewMode,
    chapter = chapterFilter
  ) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (view && view !== "cards") params.set("view", view);
    if (chapter) params.set("chapter", chapter);
    const query = params.toString();
    return query ? `/dashboard/applications?${query}` : "/dashboard/applications";
  }

  const availableChapters = canFilterByChapter
    ? await listApplicationChaptersByOrg(session.user.organizationId, {
        role: session.user.role,
        userChapter: session.user.chapter,
      })
    : [];
  const normalizedChapterFilter = availableChapters.find(
    (chapter) => chapter.toLowerCase() === chapterFilter?.toLowerCase()
  );

  const applications = await listApplicationsByOrg(
    session.user.organizationId,
    statusFilter,
    {
      role: session.user.role,
      userChapter: session.user.chapter,
      selectedChapter: normalizedChapterFilter,
    }
  );

  const serializedApplications = applications.map((application) => {
    const age = calculateAge(application.dateOfBirth);
    return {
      age,
      divisionLabel: formatDivision(age),
      chapter: application.chapter ?? "Chapter pending",
      id: application.id,
      applicantName: application.applicant.name,
      applicantEmail: application.applicant.email,
      voicePartLabel: formatVoicePart(application.notes),
      eventName: application.event.name,
      status: application.status,
      isForwarded: wasForwardedBypass(application.notes),
      submittedLabel: formatDate(application.submittedAt),
      headshotUrl: getDisplayHeadshot(application.headshot, application.id),
    };
  });

  const canBatchDelete = session.user.role === "ADMIN";
  const tabBaseClass =
    "text-sm px-2.5 py-1.5 rounded-md border font-medium transition";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex flex-wrap gap-1.5">
              <Link
                href={buildApplicationsHref(undefined)}
                className={`${tabBaseClass} ${statusFilterClasses(undefined, !statusFilter)}`}
              >
                All
              </Link>
              {visibleStatusOptions.map((status) => (
                <Link
                  key={status}
                  href={buildApplicationsHref(status)}
                  className={`${tabBaseClass} ${statusFilterClasses(
                    status,
                    activeStatusLabel === STATUS_LABELS[status]
                  )}`}
                >
                  {STATUS_LABELS[status]}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View:</span>
            <Link
              href={buildApplicationsHref(statusFilter, "cards")}
              className={`${tabBaseClass} ${
                viewMode === "cards"
                  ? "bg-[#e9f4ec] border-[#8eb89c] text-[#1f5b38]"
                  : "bg-[#fffdf5] border-[#e5d8ab] text-[#6b5a23] hover:bg-[#f9f2da]"
              }`}
            >
              Cards
            </Link>
            <Link
              href={buildApplicationsHref(statusFilter, "list")}
              className={`${tabBaseClass} ${
                viewMode === "list"
                  ? "bg-[#e9f4ec] border-[#8eb89c] text-[#1f5b38]"
                  : "bg-[#fffdf5] border-[#e5d8ab] text-[#6b5a23] hover:bg-[#f9f2da]"
              }`}
            >
              List
            </Link>
          </div>

          {canFilterByChapter ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Chapter:</span>
              <form action="/dashboard/applications" className="flex items-center gap-2">
                <input type="hidden" name="view" value={viewMode} />
                {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
                <select
                  name="chapter"
                  defaultValue={normalizedChapterFilter ?? ""}
                  className="h-9 rounded-md border border-[#d7cde9] bg-[#fffdf5] px-3 text-sm text-[#4a3d6b] outline-none transition focus:border-[#8eb89c]"
                >
                  <option value="">All chapters</option>
                  {availableChapters.map((chapter) => (
                    <option key={chapter} value={chapter}>
                      {chapter}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-md border border-[#8eb89c] bg-[#e9f4ec] px-3 text-sm font-medium text-[#1f5b38] transition hover:bg-[#dceddf]"
                >
                  Apply
                </button>
                {normalizedChapterFilter ? (
                  <Link
                    href={buildApplicationsHref(statusFilter, viewMode, undefined)}
                    className="inline-flex h-9 items-center rounded-md border border-[#d7cde9] bg-[#fffdf5] px-3 text-sm font-medium text-[#4a3d6b] transition hover:bg-[#f7f1ff]"
                  >
                    Clear
                  </Link>
                ) : null}
              </form>
            </div>
          ) : null}
        </div>
      </div>

      {serializedApplications.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {statusFilter
            ? "No applications found for the selected filter."
            : "No applications have been submitted yet."}
        </p>
      ) : (
        <BatchApplicationsTable
          applications={serializedApplications}
          canBatchDelete={canBatchDelete}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}
