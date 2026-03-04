import { ApplicationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING_APPROVAL: "Pending Approval",
  CORRECTION_REQUIRED: "Correction Required",
  APPROVED_FOR_CHAPTER_ADJUDICATION: "Approved for Chapter Adjudication",
  PENDING_NATIONAL_ACCEPTANCE: "Chapter Winner - Advanced to National Adjudication (Pending Approval)",
  APPROVED_FOR_NATIONAL_ADJUDICATION: "Approved for National Adjudication",
  EXCLUDED: "Excluded",
  ALTERNATE: "Alternate",
  DID_NOT_ADVANCE: "Did Not Advance",
  WITHDRAWN: "Withdrawn",
  SUBMITTED_PENDING_APPROVAL: "Pending Approval",
  CHAPTER_ADJUDICATION: "Approved for Chapter Adjudication",
  NATIONAL_FINALS: "Approved for National Adjudication",
  SUBMITTED: "Pending Approval",
  CHAPTER_REVIEW: "Approved for Chapter Adjudication",
  CHAPTER_APPROVED: "Chapter Winner - Advanced to National Adjudication (Pending Approval)",
  CHAPTER_REJECTED: "Excluded",
  NATIONAL_REVIEW: "Approved for National Adjudication",
  NATIONAL_APPROVED: "Withdrawn",
  NATIONAL_REJECTED: "Excluded",
  DECIDED: "Withdrawn",
};

const STATUS_STYLES: Record<
  ApplicationStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; className?: string }
> = {
  PENDING_APPROVAL: {
    variant: "outline",
    className: "border-[#ead9a0] bg-[#fff3cd] text-[#856404]",
  },
  CORRECTION_REQUIRED: {
    variant: "outline",
    className: "border-[#ead9a0] bg-[#fff3cd] text-[#856404]",
  },
  APPROVED_FOR_CHAPTER_ADJUDICATION: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#5f2ec8]",
  },
  PENDING_NATIONAL_ACCEPTANCE: {
    variant: "outline",
    className: "border-[#9fdcc4] bg-[#d6f6e8] text-[#147a58]",
  },
  APPROVED_FOR_NATIONAL_ADJUDICATION: {
    variant: "outline",
    className: "border-[#9fdcc4] bg-[#d6f6e8] text-[#147a58]",
  },
  EXCLUDED: {
    variant: "outline",
    className: "border-[#f5b8b8] bg-[#ffe4e4] text-[#b42318]",
  },
  ALTERNATE: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#8b7ab5]",
  },
  DID_NOT_ADVANCE: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#8b7ab5]",
  },
  WITHDRAWN: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#8b7ab5]",
  },
  SUBMITTED_PENDING_APPROVAL: {
    variant: "outline",
    className: "border-[#ead9a0] bg-[#fff3cd] text-[#856404]",
  },
  CHAPTER_ADJUDICATION: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#5f2ec8]",
  },
  NATIONAL_FINALS: {
    variant: "outline",
    className: "border-[#9fdcc4] bg-[#d6f6e8] text-[#147a58]",
  },
  SUBMITTED: {
    variant: "outline",
    className: "border-[#ead9a0] bg-[#fff3cd] text-[#856404]",
  },
  CHAPTER_REVIEW: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#5f2ec8]",
  },
  CHAPTER_APPROVED: {
    variant: "outline",
    className: "border-[#9fdcc4] bg-[#d6f6e8] text-[#147a58]",
  },
  CHAPTER_REJECTED: {
    variant: "outline",
    className: "border-[#f5b8b8] bg-[#ffe4e4] text-[#b42318]",
  },
  NATIONAL_REVIEW: {
    variant: "outline",
    className: "border-[#9fdcc4] bg-[#d6f6e8] text-[#147a58]",
  },
  NATIONAL_APPROVED: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#8b7ab5]",
  },
  NATIONAL_REJECTED: {
    variant: "outline",
    className: "border-[#f5b8b8] bg-[#ffe4e4] text-[#b42318]",
  },
  DECIDED: {
    variant: "outline",
    className: "border-[#d8cce9] bg-[#f0ecfa] text-[#8b7ab5]",
  },
};

export default function ApplicationStatusBadge({
  status,
}: {
  status: ApplicationStatus;
}) {
  const style = STATUS_STYLES[status];
  return (
    <Badge
      variant={style.variant}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.01em] ${style.className}`}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
