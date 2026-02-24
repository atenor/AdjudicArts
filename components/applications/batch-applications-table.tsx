"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ApplicationStatus } from "@prisma/client";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ApplicationRow = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  voicePartLabel: string;
  eventName: string;
  status: ApplicationStatus;
  submittedLabel: string;
  headshotUrl: string;
};

export default function BatchApplicationsTable({
  applications,
  canBatchDelete,
}: {
  applications: ApplicationRow[];
  canBatchDelete: boolean;
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
          <p className="text-sm text-muted-foreground">
            {selectedCount} selected
          </p>
          <button
            type="button"
            onClick={deleteSelected}
            disabled={selectedCount === 0 || isDeleting}
            className="inline-flex items-center rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {canBatchDelete && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all applications"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
              </TableHead>
            )}
            <TableHead>Applicant</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Voice Part</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.map((application) => (
            <TableRow key={application.id}>
              {canBatchDelete && (
                <TableCell>
                  <input
                    type="checkbox"
                    aria-label={`Select ${application.applicantName}`}
                    checked={selectedSet.has(application.id)}
                    onChange={(event) => toggleOne(application.id, event.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={application.headshotUrl}
                    alt={`${application.applicantName} headshot`}
                    className="h-9 w-9 rounded-full object-cover border border-border/70 bg-muted"
                    loading="lazy"
                  />
                  <Link
                    href={`/dashboard/applications/${application.id}`}
                    className="font-medium hover:underline"
                  >
                    {application.applicantName}
                  </Link>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {application.applicantEmail}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {application.voicePartLabel}
              </TableCell>
              <TableCell className="text-sm">{application.eventName}</TableCell>
              <TableCell>
                <ApplicationStatusBadge status={application.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {application.submittedLabel}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
