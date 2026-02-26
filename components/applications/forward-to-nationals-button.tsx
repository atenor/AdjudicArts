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
    <div className="space-y-2 rounded-lg border border-[#d7cde9] bg-[#faf7ff] p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
        Bypass Chapter Adjudication
      </p>
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason (optional)"
        className="w-full rounded-md border border-[#d7cde9] bg-white px-2 py-1.5 text-sm text-[#2b2350] outline-none focus:ring-2 focus:ring-[#5f2ec8]"
        maxLength={500}
      />
      <button
        type="button"
        onClick={() => void onForward()}
        disabled={isSubmitting || disabledByCitizenship}
        className="w-full rounded-md border border-[#8a67cd] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting
          ? "Forwarding..."
          : "Forward to Nationals (Bypass Chapter Adjudication)"}
      </button>
      {disabledByCitizenship ? (
        <p className="text-xs font-semibold text-[#b42318]">
          Verify citizenship before forwarding to nationals.
        </p>
      ) : null}
      {saved ? <p className="text-xs text-emerald-700">Forwarded to nationals.</p> : null}
      {serverError ? <p className="text-xs text-destructive">{serverError}</p> : null}
    </div>
  );
}
