"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      "Delete this event and all related data? This will permanently remove participant applications, scores, rounds, and assignments for this event."
    );
    if (!ok) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload?.error ?? "Unable to delete event.");
        return;
      }

      router.push("/dashboard/events");
      router.refresh();
    } catch {
      setError("Unable to delete event.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="destructive" onClick={onDelete} disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete Event"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
