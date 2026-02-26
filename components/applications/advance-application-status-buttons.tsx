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
  SUBMITTED_PENDING_APPROVAL: [
    { label: "Approve to Chapter Adjudication", status: "CHAPTER_ADJUDICATION" },
    { label: "Reject", status: "CHAPTER_REJECTED", variant: "destructive" },
  ],
  CHAPTER_ADJUDICATION: [{ label: "Advance to National Finals", status: "NATIONAL_FINALS" }],
  NATIONAL_FINALS: [],
  SUBMITTED: [
    { label: "Approve to Chapter Adjudication", status: "CHAPTER_ADJUDICATION" },
    { label: "Reject", status: "CHAPTER_REJECTED", variant: "destructive" },
  ],
  CHAPTER_REVIEW: [
    { label: "Advance to National Finals", status: "NATIONAL_FINALS" },
    { label: "Reject Chapter", status: "CHAPTER_REJECTED", variant: "destructive" },
  ],
  CHAPTER_APPROVED: [{ label: "Advance to National Finals", status: "NATIONAL_FINALS" }],
  CHAPTER_REJECTED: [],
  NATIONAL_REVIEW: [
    { label: "Approve National", status: "NATIONAL_APPROVED" },
    { label: "Reject National", status: "NATIONAL_REJECTED", variant: "destructive" },
  ],
  NATIONAL_APPROVED: [{ label: "Mark Decided", status: "DECIDED" }],
  NATIONAL_REJECTED: [{ label: "Mark Decided", status: "DECIDED", variant: "outline" }],
  DECIDED: [],
};

const STATUS_OPTIONS: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "SUBMITTED_PENDING_APPROVAL", label: "Submitted — Pending Approval" },
  { value: "CHAPTER_ADJUDICATION", label: "Chapter Adjudication" },
  { value: "NATIONAL_FINALS", label: "National Finals" },
  { value: "CHAPTER_REJECTED", label: "Chapter Rejected" },
  { value: "NATIONAL_REJECTED", label: "National Rejected" },
  { value: "DECIDED", label: "Decided" },
];

export default function AdvanceApplicationStatusButtons({
  applicationId,
  currentStatus,
  allowOverrideAll = false,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  allowOverrideAll?: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<ApplicationStatus>(currentStatus);
  const [overrideReason, setOverrideReason] = useState("");
  const actions = STATUS_ACTIONS[currentStatus];

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
        setServerError("Failed to update application status.");
        return;
      }

      // Reject actions can move the record outside the current role's visibility.
      // Navigate back to the list to avoid landing on a 404 detail route.
      if (status === "CHAPTER_REJECTED" || status === "NATIONAL_REJECTED") {
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
    await advance(overrideStatus, reason);
  }

  if (actions.length === 0) {
    return <p className="text-sm text-muted-foreground">No status actions available.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            variant={action.variant ?? "default"}
            onClick={() => void advance(action.status)}
            disabled={isSubmitting}
          >
            {action.label}
          </Button>
        ))}
      </div>
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
