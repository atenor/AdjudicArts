"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ForwardToNationalsButton({
  applicationId,
  disabledByCitizenship = false,
}: {
  applicationId: string;
  disabledByCitizenship?: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onForward() {
    setIsSubmitting(true);
    setServerError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "FORWARD_TO_NATIONALS_BYPASS_CHAPTER",
          reason: reason.trim() || undefined,
        }),
      });

      if (!response.ok) {
        let message = "Unable to forward applicant to nationals.";
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

      setSaved(true);
      router.refresh();
    } catch {
      setServerError("Unable to forward applicant to nationals.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        className="w-full max-w-md rounded-md border border-[#d7cde9] bg-white px-2.5 py-1.5 text-sm text-[#2b2350] outline-none focus:ring-2 focus:ring-[#5f2ec8]"
        maxLength={500}
      />
      <button
        type="button"
        onClick={() => void onForward()}
        disabled={isSubmitting || disabledByCitizenship}
        className="rounded-md border border-[#cfc3e3] bg-white px-3 py-1.5 text-sm font-semibold text-[#5f4d87] hover:bg-[#f4effb] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Sending…" : "Send Directly to Nationals"}
      </button>
      {disabledByCitizenship ? (
        <p className="text-xs text-[#b42318]">Verify citizenship before using this bypass.</p>
      ) : null}
      {saved ? (
        <p className="text-xs font-semibold text-[#166a46]">
          Advanced to national adjudication — pending national approval.
        </p>
      ) : null}
      {serverError ? <p className="text-xs text-[#b42318]">{serverError}</p> : null}
    </div>
  );
}
