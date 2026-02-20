import { EventStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<EventStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CHAPTER_REVIEW: "Chapter Review",
  JUDGING: "Judging",
  NATIONAL_REVIEW: "National Review",
  DECIDED: "Decided",
  CLOSED: "Closed",
};

const STATUS_VARIANTS: Record<
  EventStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  OPEN: "default",
  CHAPTER_REVIEW: "secondary",
  JUDGING: "default",
  NATIONAL_REVIEW: "secondary",
  DECIDED: "destructive",
  CLOSED: "outline",
};

export default function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
  );
}
