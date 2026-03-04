"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CheckCircle2, RefreshCcw, Upload } from "lucide-react";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type PreviewRow = {
  rosterRow: {
    chapter: string;
    firstName: string;
    lastName: string;
    expectedAge: number | null;
  };
  matchStatus: "unique_match" | "no_match" | "ambiguous" | "pending_chapter" | "invalid_dob";
  applicationId?: string;
  applicationName?: string;
  currentChapter?: string | null;
  targetChapter?: string;
  currentStatus?: string;
  dobAge?: number | null;
  recommendedAction: "correct_chapter" | "correct_and_advance" | "none" | "manual_review";
  reasons: string[];
  canCorrectChapter: boolean;
  canAdvance: boolean;
  selectedByDefault: boolean;
};

type Summary = {
  totalRows: number;
  uniqueMatches: number;
  noMatches: number;
  ambiguousMatches: number;
  needsReview: number;
  readyToCorrect: number;
  readyToAdvance: number;
  corrected?: number;
  advanced?: number;
  blocked?: number;
};

type ReconciliationResponse = {
  preview: PreviewRow[];
  summary: Summary;
};

function buildDefaultSelection(preview: PreviewRow[]) {
  return new Set(
    preview.filter((row) => row.selectedByDefault && row.applicationId).map((row) => row.applicationId!)
  );
}

function getRowIntent(row: PreviewRow) {
  if (row.matchStatus === "pending_chapter") {
    return {
      label: "Pending chapter",
      className: "border-[#ead7a2] bg-[#fff7df] text-[#856404]",
    };
  }
  if (row.matchStatus === "invalid_dob" || row.matchStatus === "no_match" || row.matchStatus === "ambiguous") {
    return {
      label: "Needs review",
      className: "border-[#f1c0c0] bg-[#fff1f1] text-[#b42318]",
    };
  }
  if (row.canCorrectChapter && row.canAdvance) {
    return {
      label: "Correct + advance",
      className: "border-[#b7e8de] bg-[#eefbf6] text-[#147a58]",
    };
  }
  if (row.canCorrectChapter) {
    return {
      label: "Correct chapter",
      className: "border-[#cfe6d8] bg-[#f2fbf5] text-[#147a58]",
    };
  }
  if (row.canAdvance) {
    return {
      label: "Advance eligible",
      className: "border-[#cfe6d8] bg-[#f2fbf5] text-[#147a58]",
    };
  }
  return {
    label: "No change",
    className: "border-[#ddd4ef] bg-[#f7f3ff] text-[#6d5b91]",
  };
}

function SummaryChip({
  label,
  value,
  tone = "purple",
}: {
  label: string;
  value: number;
  tone?: "purple" | "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-[#cfe6d8] bg-[#f2fbf5] text-[#147a58]"
      : tone === "amber"
        ? "border-[#ead7a2] bg-[#fff7df] text-[#856404]"
        : tone === "red"
          ? "border-[#f1c0c0] bg-[#fff1f1] text-[#b42318]"
          : "border-[#ddd4ef] bg-[#f7f3ff] text-[#6d5b91]";

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function NationalPrepReconciliationDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rosterText, setRosterText] = useState("");
  const [previewResult, setPreviewResult] = useState<ReconciliationResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectableRows = useMemo(
    () =>
      (previewResult?.preview ?? []).filter(
        (row) => row.applicationId && (row.canCorrectChapter || row.canAdvance)
      ),
    [previewResult]
  );

  const allSelectableSelected =
    selectableRows.length > 0 &&
    selectableRows.every((row) => row.applicationId && selectedIds.has(row.applicationId));

  async function requestPreview() {
    setError(null);
    setSuccess(null);
    setIsPreviewing(true);

    try {
      const response = await fetch("/api/applications/national-prep/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "preview",
          rosterText,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; preview?: PreviewRow[]; summary?: Summary }
        | null;

      if (!response.ok || !payload?.preview || !payload?.summary) {
        setError(payload?.error ?? "Unable to preview the pasted roster.");
        return;
      }

      const result = {
        preview: payload.preview,
        summary: payload.summary,
      };
      setPreviewResult(result);
      setSelectedIds(buildDefaultSelection(result.preview));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function applyChanges(applyNationalAdvancement: boolean) {
    if (!previewResult) return;

    setError(null);
    setSuccess(null);
    setIsApplying(true);

    try {
      const response = await fetch("/api/applications/national-prep/reconcile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "apply",
          rosterText,
          selectedApplicationIds: Array.from(selectedIds),
          applyChapterCorrections: true,
          applyNationalAdvancement,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; preview?: PreviewRow[]; summary?: Summary }
        | null;

      if (!response.ok || !payload?.preview || !payload?.summary) {
        setError(payload?.error ?? "Unable to apply the reconciliation changes.");
        return;
      }

      const result = {
        preview: payload.preview,
        summary: payload.summary,
      };
      setPreviewResult(result);
      setSelectedIds(buildDefaultSelection(result.preview));
      setSuccess(
        applyNationalAdvancement
          ? `Applied ${result.summary.corrected ?? 0} chapter corrections and advanced ${result.summary.advanced ?? 0} applicants to pending national acceptance.`
          : `Applied ${result.summary.corrected ?? 0} chapter corrections.`
      );
      router.refresh();
    } finally {
      setIsApplying(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAllSelectable() {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }

    setSelectedIds(
      new Set(selectableRows.map((row) => row.applicationId!).filter(Boolean))
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
          setSuccess(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="border-[#d7cde9] text-[#4a3d6b] hover:bg-[#f7f1ff]"
        >
          National Prep Reconciliation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden border-[#d8cce9] bg-white p-0">
        <div className="border-b border-[#eee8f8] bg-[#f7f3ff] px-6 py-5">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-[#5f2ec8]">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.24em]">
                National Prep
              </span>
            </div>
            <DialogTitle className="text-xl text-[#1e1538]">
              Reconcile Chapter Winner Roster
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6d5b91]">
              Paste the authoritative winner roster here. New York and Pennsylvania remain excluded
              from this pass, application date of birth remains the age authority, and safe rows can
              be corrected and advanced in bulk.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-5 overflow-y-auto px-6 py-5">
          <div className="space-y-2">
            <label
              htmlFor="national-prep-roster"
              className="text-sm font-semibold text-[#3d2d72]"
            >
              Winner roster
            </label>
            <Textarea
              id="national-prep-roster"
              value={rosterText}
              onChange={(event) => setRosterText(event.target.value)}
              placeholder={"CHAPTER\tAGE\tFIRST\tLAST\nFlorida – Florida Chapter\t17\tRyhanna\tTarte"}
              rows={8}
              className="border-[#d7cde9] font-mono text-sm focus-visible:ring-[#5f2ec8]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryChip
              label="Unique matches"
              value={previewResult?.summary.uniqueMatches ?? 0}
              tone="green"
            />
            <SummaryChip
              label="Needs review"
              value={previewResult?.summary.needsReview ?? 0}
              tone={(previewResult?.summary.needsReview ?? 0) > 0 ? "amber" : "purple"}
            />
            <SummaryChip
              label="Ready to correct"
              value={previewResult?.summary.readyToCorrect ?? 0}
              tone="green"
            />
            <SummaryChip
              label="Ready to advance"
              value={previewResult?.summary.readyToAdvance ?? 0}
              tone="green"
            />
          </div>

          {previewResult ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryChip label="Corrected" value={previewResult.summary.corrected ?? 0} />
              <SummaryChip label="Advanced" value={previewResult.summary.advanced ?? 0} />
              <SummaryChip
                label="Blocked"
                value={previewResult.summary.blocked ?? 0}
                tone={(previewResult.summary.blocked ?? 0) > 0 ? "red" : "purple"}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-[#f2b2b2] bg-[#fff2f2] px-3 py-2 text-sm font-medium text-[#b42318]">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-lg border border-[#bbe4d2] bg-[#f1fbf6] px-3 py-2 text-sm font-medium text-[#166a46]">
              {success}
            </p>
          ) : null}

          {previewResult ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-[#6d5b91]">
                  {previewResult.summary.totalRows} roster rows parsed. Safe rows are preselected by
                  default.
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-[#3d2d72]">
                  <input
                    type="checkbox"
                    checked={allSelectableSelected}
                    onChange={toggleAllSelectable}
                    className="h-4 w-4 rounded border-[#c9bddf] text-[#5f2ec8] focus:ring-[#5f2ec8]"
                  />
                  Select all safe rows
                </label>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#e5dbf3]">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#faf7ff]">
                      <TableHead className="w-[52px]">Use</TableHead>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Current chapter</TableHead>
                      <TableHead>Target chapter</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Reasons</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewResult.preview.map((row, index) => {
                      const rowIntent = getRowIntent(row);
                      const isSelectable = Boolean(
                        row.applicationId && (row.canCorrectChapter || row.canAdvance)
                      );
                      const isSelected =
                        row.applicationId ? selectedIds.has(row.applicationId) : false;

                      return (
                        <TableRow key={`${row.rosterRow.firstName}-${row.rosterRow.lastName}-${index}`}>
                          <TableCell>
                            {isSelectable && row.applicationId ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelected(row.applicationId!)}
                                className="h-4 w-4 rounded border-[#c9bddf] text-[#5f2ec8] focus:ring-[#5f2ec8]"
                              />
                            ) : (
                              <span className="text-xs text-[#9b8cbf]">--</span>
                            )}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="space-y-1">
                              <p className="font-semibold text-[#1e1538]">
                                {row.applicationName ??
                                  `${row.rosterRow.firstName} ${row.rosterRow.lastName}`}
                              </p>
                              {row.applicationId ? (
                                <Link
                                  href={`/dashboard/applications/${row.applicationId}`}
                                  className="text-xs font-medium text-[#5f2ec8] hover:underline"
                                >
                                  Open application
                                </Link>
                              ) : (
                                <p className="text-xs text-[#8a79b1]">Roster only</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[#3d2d72]">
                            {row.dobAge ?? "Invalid DOB"}
                          </TableCell>
                          <TableCell className="text-sm text-[#3d2d72]">
                            {row.currentChapter ?? "No Chapter"}
                          </TableCell>
                          <TableCell className="text-sm text-[#3d2d72]">
                            {row.targetChapter ?? row.rosterRow.chapter}
                          </TableCell>
                          <TableCell>
                            {row.currentStatus ? (
                              <ApplicationStatusBadge status={row.currentStatus as never} />
                            ) : (
                              <span className="text-xs text-[#8a79b1]">--</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${rowIntent.className}`}
                            >
                              {rowIntent.label}
                            </span>
                          </TableCell>
                          <TableCell className="min-w-[280px] text-sm text-[#6d5b91]">
                            <ul className="space-y-1">
                              {row.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t border-[#eee8f8] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="border-[#d7cde9] text-[#4a3d6b] hover:bg-[#f7f1ff]"
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPreviewing || isApplying || !rosterText.trim()}
            className="border-[#d7cce8] text-[#5f2ec8] hover:bg-[#f7f1ff]"
            onClick={requestPreview}
          >
            <Upload className="mr-2 h-4 w-4" />
            {isPreviewing ? "Previewing..." : "Preview Matches"}
          </Button>
          <Button
            type="button"
            disabled={isApplying || !previewResult || selectedIds.size === 0}
            className="bg-[#147a58] text-white hover:bg-[#0f684b]"
            onClick={() => applyChanges(false)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isApplying ? "Applying..." : "Apply Chapter Corrections"}
          </Button>
          <Button
            type="button"
            disabled={isApplying || !previewResult || selectedIds.size === 0}
            className="bg-[#5f2ec8] text-white hover:bg-[#4f26a8]"
            onClick={() => applyChanges(true)}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            {isApplying ? "Applying..." : "Apply Corrections + Advance Eligible"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
