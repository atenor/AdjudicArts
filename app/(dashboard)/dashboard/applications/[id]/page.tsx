export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ApplicationStatus } from "@prisma/client";
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

function valueOrDash(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return "--";
  return value;
}

function formatDateInput(value: Date | null) {
  if (!value) return "";
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAge(dateOfBirth: Date | null) {
  if (!dateOfBirth) return null;
  const now = new Date();
  let age = now.getFullYear() - dateOfBirth.getFullYear();
  const beforeBirthday =
    now.getMonth() < dateOfBirth.getMonth() ||
    (now.getMonth() === dateOfBirth.getMonth() && now.getDate() < dateOfBirth.getDate());
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
  const age = getAge(application.dateOfBirth);

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
  const hasHeadshot = !!headshotUrl;
  const videoCount = [
    application.video1Url || application.video1Title,
    application.video2Url || application.video2Title,
    application.video3Url || application.video3Title,
  ].filter(Boolean).length;

  // School display: prefer college, fall back to high school, then generic school name
  const schoolDisplay =
    application.collegeName ||
    application.highSchoolName ||
    application.schoolName ||
    null;

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
    video1Title: application.video1Title ?? "",
    video1Url: application.video1Url ?? "",
    video2Title: application.video2Title ?? "",
    video2Url: application.video2Url ?? "",
    video3Title: application.video3Title ?? "",
    video3Url: application.video3Url ?? "",
  };

  const profileViewUrls: ProfileViewUrls = {
    headshot: headshotUrl ?? undefined,
    citizenshipDocument: citizenshipDocumentHref ?? undefined,
  };

  return (
    <div className="space-y-3 pb-8">

      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center rounded-lg border border-[#d8cce9] bg-white px-3 py-2 text-sm font-medium text-[#5f2ec8] hover:bg-[#f4effb]"
        >
          ← Back to applications
        </Link>
        <p className="text-xs text-[#9284b0]">
          Submitted {application.submittedAt.toLocaleString("en-US")}
        </p>
      </div>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
        <div className="flex gap-4">

          {/* Headshot */}
          <div className="shrink-0">
            <HeadshotPreview
              src={headshotUrl}
              alt={`${application.applicant.name} headshot`}
              triggerClassName="h-32 w-24 rounded-xl border border-[#cbb7e8] object-cover shadow-sm transition hover:scale-[1.02]"
            />
          </div>

          {/* Identity */}
          <div className="min-w-0 space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-[#1a1735]">
                {application.applicant.name}
              </h1>
              <ApplicationStatusBadge status={application.status} />
            </div>

            {/* Voice · Age · Location on one line */}
            <p className="text-sm text-[#1e1538]">
              {[division, age !== null ? `Age ${age}` : null, hometown]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {/* Chapter — just the value, no appended word */}
            {application.chapter ? (
              <p className="text-sm text-[#8b7ab5]">{application.chapter}</p>
            ) : null}

            {/* School */}
            {schoolDisplay ? (
              <p className="text-sm text-[#8b7ab5]">{schoolDisplay}</p>
            ) : null}

            {/* Email */}
            <p className="pt-0.5 text-sm text-[#8b7ab5]">{application.applicant.email}</p>
          </div>
        </div>
      </section>

      {/* ── ELIGIBILITY ──────────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5 shadow-sm">

        {/* Horizontal pills */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Citizenship */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              isCitizenshipVerified
                ? "bg-[#d6f6e8] text-[#0d7b5f]"
                : "bg-[#fff3cd] text-[#856404]"
            }`}
          >
            {isCitizenshipVerified ? "✓" : "⚠"} Citizenship ·{" "}
            {isCitizenshipVerified ? "Verified" : "Unverified"}
          </span>

          {/* Headshot */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              hasHeadshot ? "bg-[#d6f6e8] text-[#0d7b5f]" : "bg-[#f0ecfa] text-[#8b7ab5]"
            }`}
          >
            {hasHeadshot ? "✓" : "○"} Headshot
          </span>

          {/* Videos */}
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              videoCount === 3
                ? "bg-[#d6f6e8] text-[#0d7b5f]"
                : videoCount > 0
                  ? "bg-[#fff3cd] text-[#856404]"
                  : "bg-[#f0ecfa] text-[#8b7ab5]"
            }`}
          >
            {videoCount === 3 ? "✓" : videoCount > 0 ? "⚠" : "○"} {videoCount}/3 Videos
          </span>

        </div>

        {/* Verify citizenship — the one accessible action when unverified */}
        {canEditProfile && !isCitizenshipVerified ? (
          <div className="mt-2.5">
            <CitizenshipVerificationButton
              applicationId={application.id}
              verified={false}
            />
          </div>
        ) : null}
      </section>

      {/* ── SINGER PROFILE ──────────────────────────────────────────────────── */}
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

      {/* ── ADMIN FUNCTIONS (collapsed) ──────────────────────────────────────── */}
      {((canEditProfile && isCitizenshipVerified) || canSeeStatusActions || canForwardToNationalsBypass || canDeleteApplication) ? (
        <details className="rounded-xl border border-[#ddd3f0] bg-white shadow-sm">
          <summary className="cursor-pointer list-none rounded-xl px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-[#8b7ab5] hover:bg-[#f8f4ff]">
            ▶ Admin Functions
          </summary>
          <div className="divide-y divide-[#eee8f8] border-t border-[#eee8f8]">

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
                  <p className="mb-3 rounded-md border border-[#d8cce9] bg-[#f0ecfa] px-3 py-2 text-xs text-[#5f2ec8]">
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
