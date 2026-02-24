export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";

export const metadata: Metadata = { title: "Applications" };
import { redirect } from "next/navigation";
import Link from "next/link";
import { ApplicationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { listApplicationsByOrg } from "@/lib/db/applications";
import { formatVoicePart } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import BatchApplicationsTable from "@/components/applications/batch-applications-table";

const STATUS_OPTIONS: ApplicationStatus[] = [
  "SUBMITTED",
  "CHAPTER_REVIEW",
  "CHAPTER_APPROVED",
  "CHAPTER_REJECTED",
  "NATIONAL_REVIEW",
  "NATIONAL_APPROVED",
  "NATIONAL_REJECTED",
  "DECIDED",
];

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  const statusFilter =
    searchParams.status && STATUS_OPTIONS.includes(searchParams.status as ApplicationStatus)
      ? (searchParams.status as ApplicationStatus)
      : undefined;

  const applications = await listApplicationsByOrg(
    session.user.organizationId,
    statusFilter
  );

  const serializedApplications = applications.map((application) => ({
    id: application.id,
    applicantName: application.applicant.name,
    applicantEmail: application.applicant.email,
    voicePartLabel: formatVoicePart(application.notes),
    eventName: application.event.name,
    status: application.status,
    submittedLabel: formatDate(application.submittedAt),
    headshotUrl: getDisplayHeadshot(application.headshot, application.id),
  }));

  const canBatchDelete = session.user.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/dashboard/applications"
              className={`text-sm px-2 py-1 rounded border ${
                !statusFilter ? "bg-muted border-muted-foreground/20" : "hover:bg-muted/60"
              }`}
            >
              All
            </Link>
            {STATUS_OPTIONS.map((status) => (
              <Link
                key={status}
                href={`/dashboard/applications?status=${status}`}
                className={`text-sm px-2 py-1 rounded border ${
                  statusFilter === status
                    ? "bg-muted border-muted-foreground/20"
                    : "hover:bg-muted/60"
                }`}
              >
                {status.replaceAll("_", " ").toLowerCase()}
              </Link>
            ))}
          </div>
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
        />
      )}
    </div>
  );
}
