"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function RejectApplicationButton({
  applicationId,
  disabled = false,
  className = "",
}: {
  applicationId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReject() {
    if (typeof window !== "undefined") {
      const typed = window.prompt('Type "REJECT" to confirm this rejection.');
      if (typed === null) return;
      if (typed.trim().toUpperCase() !== "REJECT") return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${applicationId}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "EXCLUDED" }),
      });
      if (!response.ok) {
        let message = "Unable to reject application.";
        try {
          const data = (await response.json()) as { error?: string };
          if (typeof data.error === "string" && data.error.trim()) message = data.error;
        } catch {
          // no-op
        }
        setError(message);
        return;
      }
      router.push("/dashboard/applications");
      router.refresh();
    } catch {
      setError("Unable to reject application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={() => void onReject()}
        disabled={disabled || isSubmitting}
        className={`w-full border-[#e6a6a6] text-[#b42318] hover:bg-[#ffe9e9] ${className}`}
      >
        {isSubmitting ? "Rejecting..." : "Reject"}
      </Button>
      {error ? <p className="text-xs font-medium text-[#b42318]">{error}</p> : null}
    </div>
  );
}
