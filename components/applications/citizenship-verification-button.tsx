"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CitizenshipVerificationButton({
  applicationId,
  verified,
  disabled = false,
}: {
  applicationId: string;
  verified: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [statusNote, setStatusNote] = useState<string | null>(null);

  async function onToggle(confirmed = false) {
    if (!verified && !confirming && !confirmed) {
      setConfirming(true);
      return;
    }

    if (!verified && confirmationText.trim().toUpperCase() !== "VERIFY") {
      setError('Type "VERIFY" to confirm citizenship verification.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setStatusNote(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizenshipVerified: !verified,
        }),
      });

      if (!response.ok) {
        setError("Unable to update citizenship verification.");
        return;
      }

      setStatusNote(
        !verified
          ? "Citizenship verification saved."
          : "Citizenship set to unverified."
      );
      router.refresh();
      setConfirming(false);
      setConfirmationText("");
    } catch {
      setError("Unable to update citizenship verification.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming && !verified ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#f1df97] bg-[#fff3cd] px-2.5 py-2">
          <Input
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder='Type "VERIFY"'
            className="h-8 w-36 border-[#e3c86f] bg-white text-xs"
          />
          <Button
            type="button"
            variant="outline"
            className="h-8 border-[#0d7b5f] bg-white text-xs text-[#0d7b5f] hover:bg-[#e9fbf3]"
            onClick={() => void onToggle(true)}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Confirm verification"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-8 border-[#d3c7ea] text-xs text-[#5f2ec8] hover:bg-[#f3ecff]"
            onClick={() => {
              setConfirming(false);
              setConfirmationText("");
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : null}
      {!confirming ? (
        <Button
          type="button"
          variant="outline"
          className="border-[#c7b6e5] text-[#5f2ec8] hover:bg-[#f3ecff]"
          disabled={disabled || isSaving}
          onClick={() => void onToggle()}
        >
          {isSaving
            ? "Updating..."
            : verified
              ? "Mark citizenship unverified"
              : "Verify citizenship"}
        </Button>
      ) : null}
      {error ? <p className="text-sm font-medium text-[#b42318]">{error}</p> : null}
      {!error && statusNote ? <p className="text-sm font-medium text-[#0d7b5f]">{statusNote}</p> : null}
    </div>
  );
}
