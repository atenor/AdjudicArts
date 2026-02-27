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
  SUBMITTED_PENDING_APPROVAL: {
    variant: "outline",
    className: "border-[#c19a2e] bg-[#fff7dc] text-[#7a5c10]",
  },
  CHAPTER_ADJUDICATION: {
    variant: "outline",
    className: "border-[#3b6ec2] bg-[#eaf2ff] text-[#214f9b]",
  },
  NATIONAL_FINALS: {
    variant: "outline",
    className: "border-[#6a50b8] bg-[#f0ebff] text-[#472d96]",
  },
  SUBMITTED: {
    variant: "outline",
    className: "border-[#c19a2e] bg-[#fff7dc] text-[#7a5c10]",
  },
  CHAPTER_REVIEW: {
    variant: "outline",
    className: "border-[#3b6ec2] bg-[#eaf2ff] text-[#214f9b]",
  },
  CHAPTER_APPROVED: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  CHAPTER_REJECTED: { variant: "destructive" },
  NATIONAL_REVIEW: {
    variant: "outline",
    className: "border-[#6a50b8] bg-[#f0ebff] text-[#472d96]",
  },
  NATIONAL_APPROVED: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  NATIONAL_REJECTED: { variant: "destructive" },
  DECIDED: { variant: "outline", className: "border-[#8892a6] bg-[#eef2f8] text-[#485166]" },
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
