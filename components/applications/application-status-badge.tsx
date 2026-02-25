import { ApplicationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED_PENDING_APPROVAL: "Submitted — Pending Approval",
  CHAPTER_ADJUDICATION: "Chapter Adjudication",
  NATIONAL_FINALS: "National Finals",
  SUBMITTED: "Submitted — Pending Approval",
  CHAPTER_REVIEW: "Chapter Adjudication",
  CHAPTER_APPROVED: "Chapter Approved",
  CHAPTER_REJECTED: "Chapter Rejected",
  NATIONAL_REVIEW: "National Finals",
  NATIONAL_APPROVED: "National Approved",
  NATIONAL_REJECTED: "National Rejected",
  DECIDED: "Decided",
};

const STATUS_STYLES: Record<
  ApplicationStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  SUBMITTED_PENDING_APPROVAL: { variant: "secondary" },
  CHAPTER_ADJUDICATION: { variant: "outline" },
  NATIONAL_FINALS: { variant: "outline" },
  SUBMITTED: { variant: "secondary" },
  CHAPTER_REVIEW: { variant: "outline" },
  CHAPTER_APPROVED: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  CHAPTER_REJECTED: { variant: "destructive" },
  NATIONAL_REVIEW: { variant: "outline" },
  NATIONAL_APPROVED: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  NATIONAL_REJECTED: { variant: "destructive" },
  DECIDED: { variant: "default" },
};

export default function ApplicationStatusBadge({
  status,
}: {
  status: ApplicationStatus;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Badge variant={style.variant} className={style.className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
