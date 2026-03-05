"use client";

import { ApplicationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Action = {
  label: string;
  status: ApplicationStatus;
  variant?: "default" | "secondary" | "destructive" | "outline";
};

const STATUS_ACTIONS: Record<ApplicationStatus, Action[]> = {
  PENDING_APPROVAL: [
    {
      label: "Approve for Chapter Adjudication",
      status: "APPROVED_FOR_CHAPTER_ADJUDICATION",
    },
    {
      label: "Mark Correction Required",
      status: "CORRECTION_REQUIRED",
      variant: "secondary",
    },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  CORRECTION_REQUIRED: [
    {
      label: "Approve for Chapter Adjudication",
      status: "APPROVED_FOR_CHAPTER_ADJUDICATION",
    },
    {
      label: "Return to Pending Approval",
      status: "PENDING_APPROVAL",
      variant: "outline",
    },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  APPROVED_FOR_CHAPTER_ADJUDICATION: [
    {
      label: "Mark Chapter Winner",
      status: "PENDING_NATIONAL_ACCEPTANCE",
    },
    { label: "Mark Alternate", status: "ALTERNATE", variant: "secondary" },
    { label: "Mark Did Not Advance", status: "DID_NOT_ADVANCE", variant: "outline" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  PENDING_NATIONAL_ACCEPTANCE: [
    {
      label: "Accept for National Adjudication",
      status: "APPROVED_FOR_NATIONAL_ADJUDICATION",
    },
    {
      label: "Request Correction",
      status: "CORRECTION_REQUIRED",
      variant: "secondary",
    },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  APPROVED_FOR_NATIONAL_ADJUDICATION: [],
  EXCLUDED: [],
  ALTERNATE: [
    {
      label: "Mark Chapter Winner",
      status: "PENDING_NATIONAL_ACCEPTANCE",
    },
    { label: "Mark Did Not Advance", status: "DID_NOT_ADVANCE", variant: "outline" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  DID_NOT_ADVANCE: [],
  WITHDRAWN: [],
  SUBMITTED_PENDING_APPROVAL: [
    { label: "Approve for Chapter Adjudication", status: "APPROVED_FOR_CHAPTER_ADJUDICATION" },
    { label: "Mark Correction Required", status: "CORRECTION_REQUIRED", variant: "secondary" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  CHAPTER_ADJUDICATION: [
    { label: "Mark Chapter Winner", status: "PENDING_NATIONAL_ACCEPTANCE" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  NATIONAL_FINALS: [],
  SUBMITTED: [
    { label: "Approve for Chapter Adjudication", status: "APPROVED_FOR_CHAPTER_ADJUDICATION" },
    { label: "Mark Correction Required", status: "CORRECTION_REQUIRED", variant: "secondary" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  CHAPTER_REVIEW: [
    { label: "Mark Chapter Winner", status: "PENDING_NATIONAL_ACCEPTANCE" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  CHAPTER_APPROVED: [
    { label: "Accept for National Adjudication", status: "APPROVED_FOR_NATIONAL_ADJUDICATION" },
    { label: "Reject application", status: "EXCLUDED", variant: "destructive" },
  ],
  CHAPTER_REJECTED: [],
  NATIONAL_REVIEW: [
    { label: "Exclude", status: "EXCLUDED", variant: "destructive" },
  ],
  NATIONAL_APPROVED: [],
  NATIONAL_REJECTED: [],
  DECIDED: [],
};

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "CORRECTION_REQUIRED", label: "Correction Required" },
  { value: "APPROVED_FOR_CHAPTER_ADJUDICATION", label: "Approved for Chapter Adjudication" },
  { value: "PENDING_NATIONAL_ACCEPTANCE", label: "Chapter Winner - Advanced to National Adjudication (Pending Approval)" },
  { value: "APPROVED_FOR_NATIONAL_ADJUDICATION", label: "Approved for National Adjudication" },
  { value: "ALTERNATE", label: "Alternate" },
  { value: "DID_NOT_ADVANCE", label: "Did Not Advance" },
  { value: "EXCLUDED", label: "Excluded" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const FORWARD_STATUSES = new Set<ApplicationStatus>([
  "APPROVED_FOR_CHAPTER_ADJUDICATION",
  "PENDING_NATIONAL_ACCEPTANCE",
  "APPROVED_FOR_NATIONAL_ADJUDICATION",
  "CHAPTER_ADJUDICATION",
  "CHAPTER_REVIEW",
  "CHAPTER_APPROVED",
  "NATIONAL_FINALS",
  "NATIONAL_REVIEW",
  "NATIONAL_APPROVED",
  "DECIDED",
]);

const REJECT_STATUSES = new Set<ApplicationStatus>([
  "EXCLUDED",
  "CHAPTER_REJECTED",
  "NATIONAL_REJECTED",
]);

export default function AdvanceApplicationStatusButtons({
  applicationId,
  currentStatus,
  allowOverrideAll = false,
  citizenshipVerified = false,
  eligibilityVerified = false,
  eligibilityBlockingReasons = [],
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  allowOverrideAll?: boolean;
  citizenshipVerified?: boolean;
  eligibilityVerified?: boolean;
  eligibilityBlockingReasons?: string[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<ApplicationStatus>(currentStatus);
  const [overrideReason, setOverrideReason] = useState("");
  const actions = STATUS_ACTIONS[currentStatus];
  const needsApproveConfirmation =
    currentStatus === "PENDING_APPROVAL" ||
    currentStatus === "SUBMITTED_PENDING_APPROVAL" ||
    currentStatus === "SUBMITTED" ||
    currentStatus === "CORRECTION_REQUIRED";

  async function advance(status: ApplicationStatus, reason?: string) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason }),
      });

      if (!response.ok) {
        let message = "Failed to update application status.";
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data.error === "string" && data.error.trim().length > 0) {
            message = data.error;
          }
        } catch {
          // no-op
        }
        setServerError(message);
        return;
      }

      // Reject actions can move the record outside the current role's visibility.
      // Navigate back to the list to avoid landing on a 404 detail route.
      if (status === "EXCLUDED" || status === "CHAPTER_REJECTED" || status === "NATIONAL_REJECTED") {
        router.push("/dashboard/applications");
        return;
      }

      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOverride() {
    if (!allowOverrideAll) return;
    const reason = overrideReason.trim();
    if (!reason) {
      setServerError("Override reason is required.");
      return;
    }
    if (!citizenshipVerified && FORWARD_STATUSES.has(overrideStatus)) {
      setServerError("Citizenship must be verified before advancing this application.");
      return;
    }
    if (
      !eligibilityVerified &&
      (overrideStatus === "APPROVED_FOR_CHAPTER_ADJUDICATION" ||
        overrideStatus === "CHAPTER_ADJUDICATION")
    ) {
      setServerError("Complete eligibility verification before approving for chapter adjudication.");
      return;
    }
    if (REJECT_STATUSES.has(overrideStatus) && !confirmRejectAction()) return;
    await advance(overrideStatus, reason);
  }

  function confirmApproveForChapterAdjudication() {
    if (typeof window === "undefined") return true;
    return window.confirm(
      "Approve application for chapter adjudication?\n\nThis will move the applicant out of Pending Approval."
    );
  }

  function confirmRejectAction() {
    if (typeof window === "undefined") return true;
    const typed = window.prompt('Type "REJECT" to confirm this rejection.');
    return typed?.trim().toUpperCase() === "REJECT";
  }

  function handleActionClick(action: Action) {
    if (REJECT_STATUSES.has(action.status) && !confirmRejectAction()) return;
    if (
      action.status === "APPROVED_FOR_CHAPTER_ADJUDICATION" &&
      needsApproveConfirmation &&
      !confirmApproveForChapterAdjudication()
    ) {
      return;
    }
    void advance(action.status);
  }

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">No status actions available.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          (() => {
            const blockedByCitizenship =
              !citizenshipVerified && FORWARD_STATUSES.has(action.status);
            const blockedByEligibility =
              !eligibilityVerified &&
              (action.status === "APPROVED_FOR_CHAPTER_ADJUDICATION" ||
                action.status === "CHAPTER_ADJUDICATION");
            return (
          <Button
            key={action.status}
            type="button"
            variant={action.variant ?? "default"}
            className={
              !action.variant
                ? "bg-[#147a58] text-white shadow hover:bg-[#0f6047]"
                : undefined
            }
            onClick={() => handleActionClick(action)}
            disabled={isSubmitting || blockedByCitizenship || blockedByEligibility}
            title={
              blockedByCitizenship
                ? "Verify citizenship before advancing."
                : blockedByEligibility
                  ? "Complete eligibility verification first."
                  : undefined
            }
          >
            {action.label}
          </Button>
            );
          })()
        ))}
      </div>
      {!citizenshipVerified ? (
        <p className="text-xs font-semibold text-[#b42318]">
          Citizenship must be verified before any forward progression.
        </p>
      ) : null}
      {!eligibilityVerified &&
      (currentStatus === "PENDING_APPROVAL" ||
        currentStatus === "SUBMITTED_PENDING_APPROVAL" ||
        currentStatus === "SUBMITTED" ||
        currentStatus === "CORRECTION_REQUIRED") ? (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[#b42318]">
            Complete all eligibility checks before approving for chapter adjudication.
          </p>
          {eligibilityBlockingReasons.length > 0 ? (
            <p className="text-xs text-[#8f3a3a]">
              Blocking items: {eligibilityBlockingReasons.join(", ")}.
            </p>
          ) : null}
        </div>
      ) : null}
      {allowOverrideAll ? (
        <details className="rounded-md border border-[#e5d9bf] bg-[#fffaf0] p-2.5">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#6f5b2d]">
            Admin / National Chair Override
          </summary>
          <p className="mt-2 text-xs text-[#6f5b2d]">
            Use only with a valid reason. This action is audited.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={overrideStatus}
              onChange={(event) =>
                setOverrideStatus(event.target.value as ApplicationStatus)
              }
              className="h-9 rounded-md border border-[#dccd9e] bg-white px-2 text-sm text-[#3c2f12]"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              placeholder="Required reason for override"
              className="max-w-sm border-[#dccd9e] bg-white focus-visible:ring-[#a6883f]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleOverride()}
              disabled={isSubmitting}
              className="border-[#dccd9e] text-[#6f5b2d] hover:bg-[#fff3d8]"
            >
              Override Status
            </Button>
          </div>
        </details>
      ) : null}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </div>
  );
}
