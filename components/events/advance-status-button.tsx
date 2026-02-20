"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EventStatus } from "@prisma/client";

const NEXT_STATUS_LABEL: Partial<Record<EventStatus, string>> = {
  DRAFT: "Open Applications",
  OPEN: "Begin Chapter Review",
  CHAPTER_REVIEW: "Begin Judging",
  JUDGING: "Begin National Review",
  NATIONAL_REVIEW: "Mark Decided",
  DECIDED: "Close Event",
};

export default function AdvanceStatusButton({
  eventId,
  currentStatus,
}: {
  eventId: string;
  currentStatus: EventStatus;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const label = NEXT_STATUS_LABEL[currentStatus];
  if (!label) return null; // Already CLOSED

  async function handleAdvance() {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/advance`, {
        method: "POST",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleAdvance} disabled={loading} variant="default">
      {loading ? "Advancing…" : label}
    </Button>
  );
}
