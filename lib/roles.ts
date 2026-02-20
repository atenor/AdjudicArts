import { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  NATIONAL_CHAIR: "National Chair",
  CHAPTER_CHAIR: "Chapter Chair",
  CHAPTER_JUDGE: "Chapter Judge",
  NATIONAL_JUDGE: "National Judge",
  APPLICANT: "Applicant",
};

export const ROLE_BADGE_VARIANTS: Record<
  Role,
  "destructive" | "default" | "secondary" | "outline"
> = {
  ADMIN: "destructive",
  NATIONAL_CHAIR: "default",
  CHAPTER_CHAIR: "secondary",
  CHAPTER_JUDGE: "outline",
  NATIONAL_JUDGE: "outline",
  APPLICANT: "secondary",
};
