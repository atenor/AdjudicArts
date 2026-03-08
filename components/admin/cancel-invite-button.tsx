"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCancelInvite() {
    const confirmed = window.confirm("Cancel this pending invite?");
    if (!confirmed) return;

    setIsCancelling(true);
    setError(null);
    try {
      const response = await fetch(`/api/users?inviteId=${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to cancel invite.");
        return;
      }
      router.refresh();
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={onCancelInvite}
        disabled={isCancelling}
        className="inline-flex h-8 items-center rounded-md border border-[#f0b6b6] bg-[#fff4f4] px-2.5 text-xs font-semibold text-[#b42318] hover:bg-[#ffe8e8] disabled:opacity-60"
      >
        {isCancelling ? "Cancelling..." : "Cancel invite"}
      </button>
      {error ? <p className="text-xs text-[#b42318]">{error}</p> : null}
    </div>
  );
}
