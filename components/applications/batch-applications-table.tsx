"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import HeadshotPreview from "@/components/shared/headshot-preview";

type ApplicationRow = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  voicePartLabel: string;
  divisionLabel?: string;
  age?: number | null;
  chapter?: string;
  eventName: string;
  status: ApplicationStatus;
  isForwarded?: boolean;
  submittedLabel: string;
  headshotUrl: string;
};

function statusSurface(status: ApplicationStatus) {
  switch (status) {
    case "SUBMITTED_PENDING_APPROVAL":
    case "SUBMITTED":
      return {
        card: "border-[#e4c56f] bg-[#fffef7]",
        list: "odd:bg-[#fffef7] even:bg-[#fffbee] hover:!bg-[#fff6d8]",
      };
    case "CHAPTER_ADJUDICATION":
    case "CHAPTER_REVIEW":
      return {
        card: "border-[#b8caef] bg-[#f7faff]",
        list: "odd:bg-[#f7faff] even:bg-[#f1f6ff] hover:!bg-[#e6efff]",
      };
    case "NATIONAL_FINALS":
    case "NATIONAL_REVIEW":
      return {
        card: "border-[#d4c8f2] bg-[#faf7ff]",
        list: "odd:bg-[#faf7ff] even:bg-[#f4eeff] hover:!bg-[#ece2ff]",
      };
    case "CHAPTER_REJECTED":
    case "NATIONAL_REJECTED":
      return {
        card: "border-[#efc7c7] bg-[#fff7f7]",
        list: "odd:bg-[#fff8f8] even:bg-[#fff2f2] hover:!bg-[#ffe7e7]",
      };
    case "CHAPTER_APPROVED":
    case "NATIONAL_APPROVED":
    case "DECIDED":
      return {
        card: "border-[#c6e7d2] bg-[#f7fffa]",
        list: "odd:bg-[#f7fffa] even:bg-[#f0fcf4] hover:!bg-[#e4f7ea]",
      };
    default:
      return {
        card: "border-[#d7cde9] bg-[#f8f4ff]",
        list: "odd:bg-white even:bg-[#f6f1ff] hover:!bg-[#ece4fb]",
      };
  }
}

export default function BatchApplicationsTable({
  applications,
  canBatchDelete,
  viewMode = "cards",
}: {
  applications: ApplicationRow[];
  canBatchDelete: boolean;
  viewMode?: "cards" | "list";
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedCount = selectedIds.length;
  const allSelected = applications.length > 0 && selectedCount === applications.length;

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? applications.map((application) => application.id) : []);
  }

  async function deleteSelected() {
    if (!canBatchDelete || selectedCount === 0 || isDeleting) return;

    const confirmed = window.confirm(
      `Delete ${selectedCount} selected application${selectedCount === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/applications/batch-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        deletedApplications?: number;
        skipped?: number;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to batch delete applications");
      }

      const deleted = payload.deletedApplications ?? 0;
      const skipped = payload.skipped ?? 0;
      const parts = [`Deleted ${deleted} application${deleted === 1 ? "" : "s"}.`];
      if (skipped > 0) {
        parts.push(`${skipped} already missing or not allowed.`);
      }
      window.alert(parts.join(" "));
      setSelectedIds([]);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to batch delete applications";
      window.alert(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      {canBatchDelete && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-[#6d5b91]">
            {selectedCount} selected
          </p>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex items-center rounded-xl border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      )}

      {canBatchDelete ? (
        <label className="flex items-center gap-2 rounded-lg border border-[#d7cde9] bg-[#f8f4ff] px-3 py-2 text-sm text-[#4a3d6b]">
          <input
            type="checkbox"
            aria-label="Select all applications"
            checked={allSelected}
            onChange={(event) => toggleAll(event.target.checked)}
            className="h-4 w-4 rounded border-[#bca9df]"
          />
          Select all
        </label>
      ) : null}

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {applications.map((application) => (
            <article
              key={application.id}
              className={`rounded-xl border p-4 shadow-sm transition hover:shadow-md ${statusSurface(application.status).card}`}
            >
              <div className="flex items-start gap-3">
                <HeadshotPreview
                  src={application.headshotUrl}
                  alt={`${application.applicantName} headshot`}
                  triggerClassName="h-20 w-20 rounded-xl border border-[#cab7e6] object-cover bg-white"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="truncate text-xl font-semibold text-[#1e1538]">
                      <Link
                        href={`/dashboard/applications/${application.id}`}
                        className="hover:text-[#5f2ec8] hover:underline"
                      >
                        {application.applicantName}
                      </Link>
                    </h3>
                    {canBatchDelete ? (
                      <input
                        type="checkbox"
                        aria-label={`Select ${application.applicantName}`}
                        checked={selectedSet.has(application.id)}
                        onChange={(event) => toggleOne(application.id, event.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-[#bca9df] text-[#5f2ec8]"
                      />
                    ) : null}
                  </div>

                  <p className="mt-0.5 text-base text-[#2e3558]">
                    {application.divisionLabel ?? "Division —"}
                    {typeof application.age === "number" ? ` • Age ${application.age}` : ""}
                  </p>
                  <p className="text-sm text-[#425173]">{application.chapter ?? "Chapter pending"}</p>
                  <p className="mt-0.5 text-sm text-[#4e5f80]">{application.applicantEmail}</p>
                  <p className="mt-0.5 text-xs text-[#5f4d83]">
                    {application.voicePartLabel} · {application.eventName}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <ApplicationStatusBadge status={application.status} />
                      {application.isForwarded ? (
                        <span className="rounded-full border border-[#e3c88a] bg-[#fff8e7] px-2 py-0.5 text-[11px] font-semibold text-[#6a4a00]">
                          Forwarded
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-[#6d5b91]">
                      Submitted {application.submittedLabel}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href={`/dashboard/applications/${application.id}`}
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#5f2ec8] to-[#462b7c] text-sm font-medium text-white shadow-sm transition hover:from-[#5327b2] hover:to-[#3e256f]"
              >
                Review Application
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#d7cde9] bg-[#f9f6ff]">
          <div className="grid grid-cols-[auto_1fr_auto] border-b border-[#d9cfea] bg-[#efe8fb] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#5a4b80]">
            <span>Applicant</span>
            <span>Details</span>
            <span className="text-right">Action</span>
          </div>
          {applications.map((application) => (
            <div
              key={application.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-[#e2d9f1] px-3 py-2 last:border-b-0 ${statusSurface(application.status).list}`}
            >
              <div className="flex items-center gap-2">
                {canBatchDelete ? (
                  <input
                    type="checkbox"
                    aria-label={`Select ${application.applicantName}`}
                    checked={selectedSet.has(application.id)}
                    onChange={(event) => toggleOne(application.id, event.target.checked)}
                    className="h-4 w-4 rounded border-[#bca9df] text-[#5f2ec8]"
                  />
                ) : null}
                <HeadshotPreview
                  src={application.headshotUrl}
                  alt={`${application.applicantName} headshot`}
                  triggerClassName="h-12 w-12 rounded-lg border border-[#cab7e6] object-cover bg-white"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#1f163a]">
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="hover:text-[#5f2ec8] hover:underline"
                  >
                    {application.applicantName}
                  </Link>
                </p>
                <p className="truncate text-xs font-medium text-[#3f4b6f]">
                  {application.divisionLabel ?? "Division —"}
                  {typeof application.age === "number" ? ` • Age ${application.age}` : ""}
                  {" · "}
                  {application.chapter ?? "Chapter pending"}
                </p>
                <p className="truncate text-xs text-[#625482]">
                  {application.voicePartLabel} · {application.eventName} · {application.submittedLabel}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <ApplicationStatusBadge status={application.status} />
                {application.isForwarded ? (
                  <span className="rounded-full border border-[#e3c88a] bg-[#fff8e7] px-2 py-0.5 text-[11px] font-semibold text-[#6a4a00]">
                    Forwarded
                  </span>
                ) : null}
                <Link
                  href={`/dashboard/applications/${application.id}`}
                  className="rounded-md border border-[#c7b7e5] px-2 py-1 text-xs font-medium text-[#4a3d6b] hover:bg-[#f4effb]"
                >
                  Open
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
