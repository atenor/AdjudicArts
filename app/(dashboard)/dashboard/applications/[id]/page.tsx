export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import {
  canAdvanceApplicationStatusByRole,
  canForwardApplicationToNationalsByRole,
  getApplicationById,
} from "@/lib/db/applications";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import AdvanceApplicationStatusButtons from "@/components/applications/advance-application-status-buttons";
import DeleteApplicationButton from "@/components/applications/delete-application-button";
import ApplicationProfileEditor, {
  type ProfileData,
  type ProfileViewUrls,
} from "@/components/applications/application-profile-editor";
import CitizenshipVerificationButton from "@/components/applications/citizenship-verification-button";
import ForwardToNationalsButton from "@/components/applications/forward-to-nationals-button";
import HeadshotPreview from "@/components/shared/headshot-preview";
import { formatVoicePart, parseApplicationMetadata } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import { getCompetitionCutoffDate, resolveApplicationDivision } from "@/lib/application-division";
import {
  getPrivateBlobCitizenshipDocumentUrl,
  isPrivateBlobRef,
} from "@/lib/blob-refs";

type RawCsv = Record<string, string>;
type BypassAuditEvent = {
  at: string;
  actorRole: string;
  actorUserId: string;
  reason: string | null;
};

type CitizenshipVerification = {
  verified: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
  updatedByRole?: string | null;
};


function formatDateInput(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: Date | null) {
  if (!value) return null;
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPhoneNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value.trim() || null;
}

function formatChapterDisplay(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(" – ").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 2 && parts[1].toLowerCase().startsWith(parts[0].toLowerCase())) {
    return parts[1];
  }
  return trimmed;
}

function getAge(dateOfBirth: Date | null, referenceDate = new Date()) {
  if (!dateOfBirth) return null;
  let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
  const beforeBirthday =
    referenceDate.getMonth() < dateOfBirth.getMonth() ||
    (referenceDate.getMonth() === dateOfBirth.getMonth() &&
      referenceDate.getDate() < dateOfBirth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function getImportedRawCsv(notes: string | null | undefined): RawCsv | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as { importProfile?: { rawCsv?: RawCsv } };
    return parsed.importProfile?.rawCsv ?? null;
  } catch {
    return null;
  }
}

function findRaw(raw: RawCsv | null, candidates: string[]) {
  if (!raw) return null;
  for (const [key, value] of Object.entries(raw)) {
    const normalized = key.toLowerCase();
    if (
      candidates.some((c) => normalized.includes(c.toLowerCase())) &&
      value.trim().length > 0
    ) {
      return value;
    }
  }
  return null;
}

function normalizeExternalUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

function extractFirstUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] ?? null;
}

function findCitizenshipDocumentUrl(raw: RawCsv | null) {
  if (!raw) return null;
  const targetKeyParts = ["citizenship", "passport", "resident", "green card", "proof", "document", "upload", "attachment", "file", "link", "url"];
  for (const [key, value] of Object.entries(raw)) {
    const normalizedKey = key.toLowerCase();
    const isLikelyCitizenshipKey =
      (normalizedKey.includes("citizen") ||
        normalizedKey.includes("passport") ||
        normalizedKey.includes("resident")) &&
      targetKeyParts.some((part) => normalizedKey.includes(part));
    if (!isLikelyCitizenshipKey) continue;
    const directUrl = normalizeExternalUrl(value);
    if (directUrl && /^https?:\/\//i.test(directUrl)) return directUrl;
    const embeddedUrl = extractFirstUrl(value);
    if (embeddedUrl) return embeddedUrl;
  }
  return null;
}

function getAdminProfileNote(notes: string | null | undefined) {
  if (!notes) return "";
  try {
    const parsed = JSON.parse(notes) as { adminProfileNote?: string };
    return typeof parsed.adminProfileNote === "string" ? parsed.adminProfileNote : "";
  } catch {
    return "";
  }
}

function getBypassAuditEvent(notes: string | null | undefined): BypassAuditEvent | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as {
      auditHistory?: unknown[];
      chapterBypassForward?: {
        at?: string;
        actorRole?: string;
        actorUserId?: string;
        reason?: string | null;
      };
    };
    if (Array.isArray(parsed.auditHistory)) {
      for (let i = parsed.auditHistory.length - 1; i >= 0; i -= 1) {
        const entry = parsed.auditHistory[i];
        if (!entry || typeof entry !== "object") continue;
        const audit = entry as Record<string, unknown>;
        if (audit.type !== "FORWARDED_TO_NATIONALS_BYPASS_CHAPTER") continue;
        return {
          at: typeof audit.at === "string" ? audit.at : new Date().toISOString(),
          actorRole: typeof audit.actorRole === "string" ? audit.actorRole : "UNKNOWN",
          actorUserId: typeof audit.actorUserId === "string" ? audit.actorUserId : "UNKNOWN",
          reason: typeof audit.reason === "string" ? audit.reason : null,
        };
      }
    }
    if (parsed.chapterBypassForward?.at) {
      return {
        at: parsed.chapterBypassForward.at,
        actorRole: parsed.chapterBypassForward.actorRole ?? "UNKNOWN",
        actorUserId: parsed.chapterBypassForward.actorUserId ?? "UNKNOWN",
        reason: typeof parsed.chapterBypassForward.reason === "string" ? parsed.chapterBypassForward.reason : null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getCitizenshipVerification(notes: string | null | undefined): CitizenshipVerification | null {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as {
      citizenshipVerification?: {
        verified?: boolean;
        updatedAt?: string | null;
        updatedBy?: string | null;
        updatedByRole?: string | null;
      };
    };
    if (typeof parsed.citizenshipVerification?.verified !== "boolean") return null;
    return {
      verified: parsed.citizenshipVerification.verified,
      updatedAt: parsed.citizenshipVerification.updatedAt ?? null,
      updatedBy: parsed.citizenshipVerification.updatedBy ?? null,
      updatedByRole: parsed.citizenshipVerification.updatedByRole ?? null,
    };
  } catch {
    return null;
  }
}

function chaptersMatch(left: string | null | undefined, right: string | null | undefined) {
  return (
    (left ?? "").trim().toLowerCase() !== "" &&
    (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase()
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR", "CHAPTER_CHAIR")) {
    if (hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) redirect("/dashboard/scoring");
    redirect("/dashboard");
  }

  const application = await getApplicationById(params.id, session.user.organizationId, {
    role: session.user.role,
    userChapter: session.user.chapter,
  });
  if (!application) notFound();

  const canEditProfile = hasRole(session, "ADMIN", "NATIONAL_CHAIR", "CHAPTER_CHAIR");
  const canDeleteApplication = hasRole(session, "ADMIN", "NATIONAL_CHAIR");
  const canAdvanceToChapterAdj = canAdvanceApplicationStatusByRole({
    role: session.user.role,
    currentStatus: application.status,
    nextStatus: "CHAPTER_ADJUDICATION",
    applicationChapter: application.chapter,
    userChapter: session.user.chapter,
  });
  const canRejectPending = canAdvanceApplicationStatusByRole({
    role: session.user.role,
    currentStatus: application.status,
    nextStatus: "CHAPTER_REJECTED",
    applicationChapter: application.chapter,
    userChapter: session.user.chapter,
  });
  const canSeeStatusActions =
    canAdvanceToChapterAdj || canRejectPending || hasRole(session, "ADMIN", "NATIONAL_CHAIR");
  const canOverrideAllStatuses = hasRole(session, "ADMIN", "NATIONAL_CHAIR");
  const canForwardToNationalsBypass = canForwardApplicationToNationalsByRole({
    role: session.user.role,
    currentStatus: application.status,
    applicationChapter: application.chapter,
    userChapter: session.user.chapter,
  });
  const chapterGateMessage =
    session.user.role === "CHAPTER_CHAIR" &&
    !chaptersMatch(application.chapter, session.user.chapter)
      ? "Pending approval actions are restricted to your chapter."
      : null;

  const metadata = parseApplicationMetadata(application.notes);
  const rawCsv = getImportedRawCsv(application.notes);
  const adminProfileNote = getAdminProfileNote(application.notes);
  const bypassAuditEvent = getBypassAuditEvent(application.notes);
  const citizenshipVerification = getCitizenshipVerification(application.notes);
  const isCitizenshipVerified = citizenshipVerification?.verified === true;
  const competitionCutoffDate = getCompetitionCutoffDate({
    openAt: application.event.openAt,
    closeAt: application.event.closeAt,
    fallbackDate: application.submittedAt,
  });
  const age = getAge(application.dateOfBirth, competitionCutoffDate);

  const division =
    metadata.voicePart ??
    findRaw(rawCsv, ["division", "age group", "category", "voice part"]) ??
    formatVoicePart(application.notes);
  const citizenship =
    metadata.citizenshipStatus ?? findRaw(rawCsv, ["citizen", "citizenship", "resident"]);
  const mediaRelease = findRaw(rawCsv, ["media release", "photo release", "release"]);
  const citizenshipDocumentUrl =
    metadata.citizenshipDocumentUrl ??
    findCitizenshipDocumentUrl(rawCsv) ??
    normalizeExternalUrl(
      findRaw(rawCsv, [
        "citizenship document", "citizenship doc", "passport",
        "id document", "proof of citizenship", "citizenship link",
      ])
    );
  const citizenshipDocumentHref =
    citizenshipDocumentUrl && isPrivateBlobRef(citizenshipDocumentUrl)
      ? getPrivateBlobCitizenshipDocumentUrl(application.id)
      : citizenshipDocumentUrl;
  const intakeResourceUrls = metadata.resourceUrls;
  const hasMediaConsent =
    mediaRelease !== null && /(yes|agree|consent|approved|true)/i.test(mediaRelease);
  const hometown =
    findRaw(rawCsv, ["hometown", "home city"]) ||
    [application.city, application.state].filter(Boolean).join(", ");
  const altContact =
    findRaw(rawCsv, ["alt contact", "alternate contact", "emergency contact"]) ||
    application.parentName;
  const altPhoneOrEmail =
    findRaw(rawCsv, ["alt phone", "alternate phone", "parent phone", "guardian phone"]) ||
    application.parentEmail;

  const headshotUrl = getDisplayHeadshot(application.headshot, application.id);
  const schoolDisplay =
    application.collegeName ||
    application.highSchoolName ||
    application.schoolName ||
    null;
  const videoUrls = [
    application.video1Url ?? metadata.videoUrls[0] ?? "",
    application.video2Url ?? metadata.videoUrls[1] ?? "",
    application.video3Url ?? metadata.videoUrls[2] ?? "",
  ];
  const videoTitles = [
    application.video1Title ?? findRaw(rawCsv, ["video #1", "video 1"]) ?? "",
    application.video2Title ?? findRaw(rawCsv, ["video #2", "video 2"]) ?? "",
    application.video3Title ?? findRaw(rawCsv, ["video #3", "video 3"]) ?? "",
  ];
  const formattedPhone = formatPhoneNumber(application.phone);
  const formattedDateOfBirth = formatDisplayDate(application.dateOfBirth);
  const addressPrimary = application.address || hometown || "--";
  const addressSecondary = [application.city, application.state, application.zip]
    .filter(Boolean)
    .join(", ");
  const schoolLocation = [application.schoolCity, application.schoolState].filter(Boolean).join(", ");
  const chapterDisplay = formatChapterDisplay(application.chapter);

  const citizenshipVerificationNote: string | null = (() => {
    if (!citizenshipVerification?.verified) return null;
    const parts = ["Verified"];
    if (citizenshipVerification.updatedByRole) parts.push(`by ${citizenshipVerification.updatedByRole}`);
    if (citizenshipVerification.updatedAt) {
      parts.push(
        `on ${new Date(citizenshipVerification.updatedAt).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })}`
      );
    }
    return parts.join(" ");
  })();

  // Eligibility signals
  const resolvedDivision = resolveApplicationDivision({
    dateOfBirth: application.dateOfBirth,
    notes: application.notes,
    competitionDate: competitionCutoffDate,
  });
  const ageEligible = age !== null && age >= 16 && age <= 22;
  const ageDobVerified = ageEligible;
  const priorFirstPrizeKnown = metadata.hasPriorFirstPrize !== null;
  const priorDivisionAllowed =
    metadata.hasPriorFirstPrize === true
      ? !metadata.priorFirstPrizeDivision || metadata.priorFirstPrizeDivision !== resolvedDivision
      : true;
  const hasHeadshot = !!headshotUrl;
  const videoCount = videoUrls.filter(Boolean).length;
  const hasThreeVideos = videoCount >= 3;
  const eligibilityVerified =
    isCitizenshipVerified &&
    hasHeadshot &&
    hasThreeVideos &&
    ageDobVerified &&
    priorFirstPrizeKnown &&
    priorDivisionAllowed;
  const remainingReviewItems = [
    !isCitizenshipVerified ? "citizenship" : null,
    !hasHeadshot ? "headshot" : null,
    !hasThreeVideos ? `${3 - videoCount} video${3 - videoCount === 1 ? "" : "s"}` : null,
    !ageDobVerified ? "age" : null,
    !priorFirstPrizeKnown ? "prior first-place declaration" : null,
    !priorDivisionAllowed ? "prior winner division conflict" : null,
  ].filter((item): item is string => Boolean(item));
  const reviewStatusLabel = eligibilityVerified ? "Eligibility Verified" : "Needs attention";
  const reviewStatusTone =
    eligibilityVerified
      ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
      : "border-[#f1df97] bg-[#fff3cd] text-[#856404]";
  const totalEligibilityChecks = 5;
  const completedEligibilityChecks = totalEligibilityChecks - remainingReviewItems.length;
  const reviewStatusDetail =
    eligibilityVerified
      ? "All eligibility checks are complete."
      : `${completedEligibilityChecks}/${totalEligibilityChecks} checks complete. Remaining: ${remainingReviewItems.join(", ")}.`;
  const reviewSummaryCards = [
    {
      label: "Citizenship",
      value: isCitizenshipVerified ? "Verified" : "Unverified",
      href: citizenshipDocumentHref ?? "#profile-editor",
      external: Boolean(citizenshipDocumentHref),
      tone: isCitizenshipVerified
        ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
        : "border-[#f1df97] bg-[#fff3cd] text-[#856404]",
    },
    {
      label: "Headshot",
      value: hasHeadshot ? "On file" : "Missing",
      href: "#profile-editor",
      tone: hasHeadshot
        ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
        : "border-[#c2b8d2] bg-[#f0ecfa] text-[#8b7ab5]",
    },
    {
      label: "Videos",
      value: `${videoCount}/3`,
      href: "#profile-editor",
      tone:
        hasThreeVideos
          ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
          : videoCount > 0
            ? "border-[#f1df97] bg-[#fff3cd] text-[#856404]"
            : "border-[#c2b8d2] bg-[#f0ecfa] text-[#8b7ab5]",
    },
    {
      label: "Age",
      value: ageDobVerified ? "Verified" : "Needs review",
      href: "#personal-information",
      tone: ageDobVerified
        ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
        : "border-[#f1df97] bg-[#fff3cd] text-[#856404]",
    },
    {
      label: "Prior 1st Prize",
      value:
        metadata.hasPriorFirstPrize === null
          ? "Not declared"
          : priorDivisionAllowed
            ? metadata.hasPriorFirstPrize
              ? "Different division"
              : "None"
            : "Same division",
      href: "#eligibility-verification",
      tone:
        metadata.hasPriorFirstPrize === null
          ? "border-[#f1df97] bg-[#fff3cd] text-[#856404]"
          : priorDivisionAllowed
            ? "border-[#b8e9d1] bg-[#d6f6e8] text-[#0d7b5f]"
            : "border-[#f1df97] bg-[#fff3cd] text-[#856404]",
    },
  ];
  const personalInfoRows = [
    { label: "Email", primary: application.applicant.email || "--" },
    { label: "Phone", primary: formattedPhone || "--" },
    { label: "DOB", primary: formattedDateOfBirth || "--" },
    { label: "Gender", primary: application.gender || "--" },
    {
      label: "Address",
      primary: addressPrimary,
      secondary: addressSecondary,
      fullWidth: true,
    },
    {
      label: "School",
      primary: schoolDisplay || "--",
      secondary: schoolLocation || "",
      fullWidth: true,
      emphasize: true,
    },
  ];

  const profileData: ProfileData = {
    applicantName: application.applicant.name,
    applicantEmail: application.applicant.email,
    chapter: application.chapter ?? "",
    dateOfBirth: formatDateInput(application.dateOfBirth),
    gender: application.gender ?? "",
    phone: application.phone ?? "",
    address: application.address ?? "",
    city: application.city ?? "",
    state: application.state ?? "",
    zip: application.zip ?? "",
    schoolName: application.schoolName ?? "",
    schoolCity: application.schoolCity ?? "",
    schoolState: application.schoolState ?? "",
    highSchoolName: application.highSchoolName ?? "",
    collegeName: application.collegeName ?? "",
    major: application.major ?? "",
    bio: application.bio ?? "",
    careerPlans: application.careerPlans ?? "",
    scholarshipUse: application.scholarshipUse ?? "",
    parentName: application.parentName ?? "",
    parentEmail: application.parentEmail ?? "",
    headshotUrl: application.headshot ?? "",
    voicePart: metadata.voicePart ?? "",
    citizenshipStatus: citizenship ?? "",
    citizenshipDocumentUrl: citizenshipDocumentUrl ?? "",
    repertoire: application.repertoire ?? "",
    adminNote: adminProfileNote,
    video1Title: videoTitles[0],
    video1Url: videoUrls[0],
    video2Title: videoTitles[1],
    video2Url: videoUrls[1],
    video3Title: videoTitles[2],
    video3Url: videoUrls[2],
  };

  const profileViewUrls: ProfileViewUrls = {
    headshot: headshotUrl ?? undefined,
    citizenshipDocument: citizenshipDocumentHref ?? undefined,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-10">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/dashboard/applications"
          className="inline-flex w-fit items-center rounded-full border border-[#c2b8d2] bg-white px-4 py-2 text-sm font-medium text-[#5f2ec8] shadow-sm hover:bg-[#f4effb]"
        >
          ← Back to applications
        </Link>
        <p className="text-xs text-[#9284b0]">
          Submitted {application.submittedAt.toLocaleString("en-US")}
        </p>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section
        id="eligibility-verification"
        className="overflow-hidden rounded-[2rem] border border-[#c2b8d2] bg-white p-3 shadow-sm sm:p-6"
      >
        <div className="mx-auto grid max-w-md gap-4 lg:max-w-none lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[1.75rem] border border-[#c7bed8] bg-[#f6f0ff] shadow-sm">
            <div className="bg-[#1e1538] px-4 pb-6 pt-5">
              <div className="mb-4 flex justify-center">
                <span className="inline-flex rounded-full border border-[#4a3977] bg-[#2b2051] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#d9cff1]">
                  Applicant Profile
                </span>
              </div>
              <div className="flex justify-center">
                <HeadshotPreview
                  src={headshotUrl}
                  alt={`${application.applicant.name} headshot`}
                  triggerClassName="aspect-[4/5] w-full max-w-[13.5rem] rounded-[1.5rem] border border-[#3c2d68] bg-[#1e1538] object-cover shadow-[0_18px_35px_-18px_rgba(0,0,0,0.55)] transition hover:scale-[1.01]"
                />
              </div>
              <div className="mt-4 text-center">
                <h1 className="text-[2rem] font-bold leading-none tracking-tight text-white">
                  {application.applicant.name}
                </h1>
              </div>
            </div>
            <div className="space-y-3 p-4">
              <div className="space-y-2 text-center lg:text-left">
                <ApplicationStatusBadge status={application.status} />
                <p className="text-sm font-medium leading-relaxed text-[#1e1538]">
                  {[division, age !== null ? `Age ${age}` : null, hometown]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {chapterDisplay ? (
                  <p className="text-sm font-semibold text-[#8b7ab5]">
                    {chapterDisplay}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[1.4rem] border border-[#c7bed8] bg-white px-4 py-3 shadow-sm lg:hidden">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7ab5]">
                    Eligibility Verification
                  </p>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reviewStatusTone}`}>
                    {reviewStatusLabel}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#6f6294]">
                  {reviewStatusDetail}
                </p>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {reviewSummaryCards.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      className={`inline-flex min-h-[2.25rem] w-full items-center justify-between gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm ${item.tone}`}
                    >
                      <span className="truncate text-[#8b7ab5]">{item.label}</span>
                      <span>{item.value}</span>
                    </a>
                  ))}
                </div>
                {canEditProfile && !isCitizenshipVerified ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {citizenshipDocumentHref ? (
                      <a
                        href={citizenshipDocumentHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-[#c2b8d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f4effb]"
                      >
                        View Citizenship Proof
                      </a>
                    ) : null}
                    <CitizenshipVerificationButton
                      applicationId={application.id}
                      verified={false}
                    />
                  </div>
                ) : null}
              </div>

            </div>
          </div>

          <div className="space-y-4">
            <div className="hidden rounded-[1.75rem] border border-[#c7bed8] bg-white px-4 py-3.5 shadow-sm sm:px-5 lg:block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7ab5]">
                    Eligibility Verification
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${reviewStatusTone}`}>
                      {reviewStatusLabel}
                    </span>
                    <p className="text-xs text-[#6f6294]">
                      {reviewStatusDetail}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 lg:grid-cols-3">
                {reviewSummaryCards.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noreferrer" : undefined}
                    className={`inline-flex min-h-[2.25rem] w-full items-center justify-between gap-2 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold shadow-sm ${item.tone}`}
                  >
                    <span className="truncate text-[#8b7ab5]">{item.label}</span>
                    <span>{item.value}</span>
                  </a>
                ))}
              </div>

              {canEditProfile && !isCitizenshipVerified ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {citizenshipDocumentHref ? (
                    <a
                      href={citizenshipDocumentHref}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-[#c2b8d2] bg-white px-3 py-1.5 text-xs font-semibold text-[#5f2ec8] hover:bg-[#f4effb]"
                    >
                      View Citizenship Proof
                    </a>
                  ) : null}
                  <CitizenshipVerificationButton
                    applicationId={application.id}
                    verified={false}
                  />
                </div>
              ) : null}
            </div>

            <div
              id="personal-information"
              className="rounded-[1.75rem] border border-[#c7bed8] bg-white px-4 py-4 shadow-sm sm:px-5"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8b7ab5]">
                Personal Information
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                {personalInfoRows.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border border-[#d6d1df] bg-[#fcfbff] px-3 py-3 ${
                      item.fullWidth ? "col-span-2" : ""
                    }`}
                  >
                    <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b7ab5]">
                      {item.label}
                    </dt>
                    <dd
                      className={`mt-1 leading-relaxed text-[#1a1735] ${
                        item.emphasize ? "text-sm font-bold sm:text-base" : "text-sm font-semibold"
                      }`}
                    >
                      {item.primary}
                    </dd>
                    {item.secondary ? (
                      <dd className="mt-0.5 text-xs leading-relaxed text-[#8b7ab5]">
                        {item.secondary}
                      </dd>
                    ) : null}
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      {/* ── SINGER PROFILE ──────────────────────────────────────────────────── */}
      <section
        id="profile-editor"
        className="rounded-[1.5rem] border border-[#c7bed8] bg-white p-3 shadow-sm sm:p-4"
      >
        <ApplicationProfileEditor
          applicationId={application.id}
          canEdit={canEditProfile}
          data={profileData}
          viewUrls={profileViewUrls}
          citizenshipVerificationNote={citizenshipVerificationNote}
          schoolStatus={
            findRaw(rawCsv, ["status", "enrollment", "student status", "in college"]) || ""
          }
          altContact={altContact ?? ""}
          altPhoneOrEmail={altPhoneOrEmail ?? ""}
          mediaRelease={mediaRelease ?? ""}
          hasMediaConsent={hasMediaConsent}
          intakeResourceUrls={intakeResourceUrls}
          youtubePlaylist={application.youtubePlaylist ?? ""}
        />
      </section>

      {/* ── ADMIN FUNCTIONS (collapsed) ──────────────────────────────────────── */}
      {((canEditProfile && isCitizenshipVerified) || canSeeStatusActions || canForwardToNationalsBypass || canDeleteApplication) ? (
        <details className="rounded-xl border border-[#c7bed8] bg-white shadow-sm">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-[#8b7ab5] hover:bg-[#f8f4ff]">
            ▶ Admin Functions
          </summary>
          <div className="divide-y divide-[#d6d1df] border-t border-[#d6d1df]">

            {/* Citizenship — unverify (rare) */}
            {canEditProfile && isCitizenshipVerified ? (
              <div className="px-4 py-3">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#8b7ab5]">
                  Citizenship Verification
                </p>
                <p className="mb-2 text-xs text-[#a09abd]">
                  Mark as unverified if the document needs to be re-reviewed.
                </p>
                <CitizenshipVerificationButton applicationId={application.id} verified={true} />
              </div>
            ) : null}

            {/* Chapter outcome */}
            {canSeeStatusActions ? (
              <div className="px-4 py-3">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#8b7ab5]">
                  Chapter Outcome
                </p>
                <p className="mb-3 text-xs text-[#a09abd]">
                  Set the final result for this applicant at the chapter level. These actions are
                  audited and should reflect actual adjudication decisions.
                </p>
                {chapterGateMessage ? (
                  <p className="mb-2 text-xs text-[#9284b0]">{chapterGateMessage}</p>
                ) : null}
                <AdvanceApplicationStatusButtons
                  applicationId={application.id}
                  currentStatus={application.status}
                  allowOverrideAll={canOverrideAllStatuses}
                  citizenshipVerified={isCitizenshipVerified}
                />
              </div>
            ) : null}

            {/* Bypass chapter adjudication */}
            {canForwardToNationalsBypass || bypassAuditEvent ? (
              <div className="px-4 py-3">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#8b7ab5]">
                  Bypass Chapter Adjudication
                </p>
                <p className="mb-3 text-xs text-[#a09abd]">
                  Sends this applicant directly to national review without completing the chapter
                  adjudication process. Only use with a clear reason and proper authorization.
                </p>
                {bypassAuditEvent ? (
                  <p className="mb-3 rounded-md border border-[#c2b8d2] bg-[#f0ecfa] px-3 py-2 text-xs text-[#5f2ec8]">
                    <span className="font-semibold">Already sent via bypass</span>
                    {" · "}
                    {new Date(bypassAuditEvent.at).toLocaleDateString("en-US")}
                    {" · "}
                    {bypassAuditEvent.actorRole}
                    {bypassAuditEvent.reason ? ` · Reason: ${bypassAuditEvent.reason}` : ""}
                  </p>
                ) : null}
                {canForwardToNationalsBypass ? (
                  <ForwardToNationalsButton
                    applicationId={application.id}
                    disabledByCitizenship={!isCitizenshipVerified}
                  />
                ) : null}
              </div>
            ) : null}

            {/* Danger zone */}
            {canDeleteApplication ? (
              <div className="rounded-b-xl bg-[#fff8f8] px-4 py-3">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-[#a04949]">
                  Danger Zone
                </p>
                <p className="mb-2 text-xs text-[#c08080]">
                  Permanently removes this applicant and all associated data. This cannot be undone.
                </p>
                <DeleteApplicationButton applicationId={application.id} />
              </div>
            ) : null}

          </div>
        </details>
      ) : null}

    </div>
  );
}
