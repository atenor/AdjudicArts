"use client";

import { ApplicationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

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

export default function AdvanceApplicationStatusButtons({
  applicationId,
  currentStatus,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const actions = STATUS_ACTIONS[currentStatus];

  async function advance(status: ApplicationStatus) {
    setIsSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </div>
  );
}
