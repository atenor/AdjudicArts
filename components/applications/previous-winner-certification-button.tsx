"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function PreviousWinnerCertificationButton({
  applicationId,
  certified,
  disabled = false,
}: {
  applicationId: string;
  certified: boolean;
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
          prizeWinnerCertification: !certified,
        }),
      });

      if (!response.ok) {
        setError("Unable to update previous winner certification.");
        return;
      }

      setStatusNote(
        !certified
          ? "Previous winner qualification certified."
          : "Previous winner qualification set to uncertified."
      );
      router.refresh();
    } catch {
      setError("Unable to update previous winner certification.");
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
          : certified
            ? "Mark prev winner uncertified"
            : "Certify prev winner"}
      </Button>
      {error ? <p className="text-sm font-medium text-[#b42318]">{error}</p> : null}
      {!error && statusNote ? <p className="text-sm font-medium text-[#0d7b5f]">{statusNote}</p> : null}
    </div>
  );
}
