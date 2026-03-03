"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  async function onToggle() {
    setIsSaving(true);
    setError(null);

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

      router.refresh();
    } catch {
      setError("Unable to update citizenship verification.");
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
            ? "Mark citizenship unverified"
            : "Verify citizenship"}
      </Button>
      {error ? <p className="text-sm font-medium text-[#b42318]">{error}</p> : null}
    </div>
  );
}
