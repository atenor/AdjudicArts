"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function LanguageRequirementVerificationButton({
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
  const [statusNote, setStatusNote] = useState<string | null>(null);

  async function onToggle() {
    setIsSaving(true);
    setError(null);
    setStatusNote(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languageRequirementVerified: !verified,
        }),
      });

      if (!response.ok) {
        setError("Unable to update language verification.");
        return;
      }

      setStatusNote(
        !verified ? "Language verification saved." : "Language verification set to unverified."
      );
      router.refresh();
    } catch {
      setError("Unable to update language verification.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
            ? "Mark languages unverified"
            : "Verify 3 languages"}
      </Button>
      {error ? <p className="text-sm font-medium text-[#b42318]">{error}</p> : null}
      {!error && statusNote ? <p className="text-sm font-medium text-[#0d7b5f]">{statusNote}</p> : null}
    </div>
  );
}
