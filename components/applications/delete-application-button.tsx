"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DeleteApplicationButton({
  applicationId,
}: {
  applicationId: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const ok = window.confirm(
      "Delete this participant application? This removes rubric scores and may delete the applicant account if no other applications exist."
    );
    if (!ok) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/applications/${applicationId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        setError("Unable to delete application.");
        return;
      }

      router.push("/dashboard/applications");
      router.refresh();
    } catch {
      setError("Unable to delete application.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="destructive" onClick={onDelete} disabled={isDeleting}>
        {isDeleting ? "Deleting..." : "Delete Participant"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
