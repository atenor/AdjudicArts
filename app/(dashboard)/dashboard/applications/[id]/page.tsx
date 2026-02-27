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
import ApplicationProfileEditor from "@/components/applications/application-profile-editor";
import ForwardToNationalsButton from "@/components/applications/forward-to-nationals-button";
import HeadshotPreview from "@/components/shared/headshot-preview";
import { formatVoicePart, parseApplicationMetadata } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import { parseRepertoireEntries } from "@/lib/repertoire";

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

const STATUS_FLOW: ApplicationStatus[] = [
  "SUBMITTED",
  "CHAPTER_REVIEW",
  "CHAPTER_APPROVED",
  "NATIONAL_REVIEW",
  "NATIONAL_APPROVED",
  "DECIDED",
];

const NEW_STATUS_FLOW: ApplicationStatus[] = [
  "SUBMITTED_PENDING_APPROVAL",
  "CHAPTER_ADJUDICATION",
  "NATIONAL_FINALS",
];

function deriveStatusTimeline(status: ApplicationStatus): ApplicationStatus[] {
  if (status === "SUBMITTED_PENDING_APPROVAL") {
    return [NEW_STATUS_FLOW[0]];
  }
  if (status === "CHAPTER_ADJUDICATION") {
    return NEW_STATUS_FLOW.slice(0, 2);
  }
  if (status === "NATIONAL_FINALS") {
    return NEW_STATUS_FLOW.slice(0, 3);
  }
  if (status === "CHAPTER_REJECTED") {
    return ["SUBMITTED", "CHAPTER_REVIEW", "CHAPTER_REJECTED"];
  }
  if (status === "NATIONAL_REJECTED") {
    return [
      "SUBMITTED",
      "CHAPTER_REVIEW",
      "CHAPTER_APPROVED",
      "NATIONAL_REVIEW",
      "NATIONAL_REJECTED",
    ];
  }

  const currentIndex = STATUS_FLOW.indexOf(status);
  if (currentIndex === -1) return [status];
  return STATUS_FLOW.slice(0, currentIndex + 1);
}

function valueOrDash(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return "--";
  return value;
}

function formatDate(value: Date | null) {
  if (!value) return "--";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTraditionalPhone(value: string | null | undefined) {
  if (!value) return "--";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "--";
  if (trimmed.includes("@")) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return trimmed;
}

function formatPhoneOrEmail(value: string | null | undefined) {
  if (!value) return "--";
  const trimmed = value.trim();
  if (trimmed.length === 0) return "--";
  if (trimmed.includes("@")) return trimmed;

  const parts = trimmed
    .split(/[\/,;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "--";
  return parts.map((part) => formatTraditionalPhone(part)).join(" / ");
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
    const parsed = JSON.parse(notes) as {
      importProfile?: {
        rawCsv?: RawCsv;
      };
    };
    return parsed.importProfile?.rawCsv ?? null;
  } catch {
    return null;
  }
}

function findRaw(raw: RawCsv | null, candidates: string[]) {
  if (!raw) return null;
  const entries = Object.entries(raw);
  for (const [key, value] of entries) {
    const normalized = key.toLowerCase();
    if (
      candidates.some((candidate) => normalized.includes(candidate.toLowerCase())) &&
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
  const entries = Object.entries(raw);
  const targetKeyParts = [
    "citizenship",
    "passport",
    "resident",
    "green card",
    "proof",
    "document",
    "upload",
    "attachment",
    "file",
    "link",
    "url",
  ];

  for (const [key, value] of entries) {
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
        reason:
          typeof parsed.chapterBypassForward.reason === "string"
            ? parsed.chapterBypassForward.reason
            : null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function getCitizenshipVerification(
  notes: string | null | undefined
): CitizenshipVerification | null {
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

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d7cde9] bg-[#f8f4ff] p-2.5">
      <p className="text-xs font-semibold tracking-wide text-[#7b6e9d]">{label}</p>
      <p className="mt-0.5 text-sm leading-snug text-[#1e1538]">{value}</p>
    </div>
  );
}

function BadgePill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function chaptersMatch(left: string | null | undefined, right: string | null | undefined) {
  return (left ?? "").trim().toLowerCase() !== "" &&
    (left ?? "").trim().toLowerCase() === (right ?? "").trim().toLowerCase();
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (
    !hasRole(
      session,
      "ADMIN",
      "NATIONAL_CHAIR",
      "CHAPTER_CHAIR"
    )
  ) {
    if (hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
      redirect("/dashboard/scoring");
    }
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
    canAdvanceToChapterAdj ||
    canRejectPending ||
    hasRole(session, "ADMIN", "NATIONAL_CHAIR");
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

  const timeline = deriveStatusTimeline(application.status);
  const repertoirePieces = parseRepertoireEntries(application.repertoire);
  const metadata = parseApplicationMetadata(application.notes);
  const rawCsv = getImportedRawCsv(application.notes);
  const adminProfileNote = getAdminProfileNote(application.notes);
  const bypassAuditEvent = getBypassAuditEvent(application.notes);
  const citizenshipVerification = getCitizenshipVerification(application.notes);
  const isCitizenshipVerified = citizenshipVerification?.verified === true;
  const age = getAge(application.dateOfBirth);

  const division =
    findRaw(rawCsv, ["division", "age group", "category", "voice part"]) ??
    formatVoicePart(application.notes);
  const citizenship = findRaw(rawCsv, ["citizen", "citizenship", "resident"]);
  const mediaRelease = findRaw(rawCsv, ["media release", "photo release", "release"]);
  const citizenshipDocumentUrl =
    metadata.citizenshipDocumentUrl ??
    findCitizenshipDocumentUrl(rawCsv) ??
    normalizeExternalUrl(
      findRaw(rawCsv, [
        "citizenship document",
        "citizenship doc",
        "passport",
        "id document",
        "proof of citizenship",
        "citizenship link",
      ])
    );
  const intakeResourceUrls = metadata.resourceUrls;
  const hasMediaConsent =
    mediaRelease !== null &&
    /(yes|agree|consent|approved|true)/i.test(mediaRelease);
  const hometown =
    findRaw(rawCsv, ["hometown", "home city"]) ||
    [application.city, application.state].filter(Boolean).join(", ");

  const altContact =
    findRaw(rawCsv, ["alt contact", "alternate contact", "emergency contact"]) ||
    application.parentName;
  const altPhoneOrEmail =
    findRaw(rawCsv, ["alt phone", "alternate phone", "parent phone", "guardian phone"]) ||
    application.parentEmail;

  const videoItems = [
    { title: application.video1Title, url: application.video1Url },
    { title: application.video2Title, url: application.video2Url },
    { title: application.video3Title, url: application.video3Url },
  ].filter((item) => item.title || item.url);

  const headshotUrl = getDisplayHeadshot(application.headshot, application.id);

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center rounded-lg border border-[#cfc3e3] bg-white px-3 py-2 text-sm font-medium text-[#5f4d87] hover:bg-[#f4effb]"
        >
          ← Back to applications
        </Link>
        <p className="text-sm text-[#776696]">
          Application Submitted: {application.submittedAt.toLocaleString("en-US")}
        </p>
      </div>

      <section className="rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[6.5rem,1fr]">
          <div className="group block" title="Open larger headshot">
            <HeadshotPreview
              src={headshotUrl}
              alt={`${application.applicant.name} headshot`}
              triggerClassName="h-32 w-24 rounded-xl border border-[#cbb7e8] object-cover shadow-sm transition group-hover:scale-[1.02]"
            />
            <p className="mt-2 text-xs font-medium text-[#7f6aa9]">
              Click thumbnail to open full-size photo
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#1a1735]">
                {application.applicant.name}
              </h1>
              <span className="text-xl text-[#c7b7e5]">☆</span>
            </div>

            <p className="text-base text-[#5f7090]">
              {valueOrDash(application.chapter)} Chapter
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <BadgePill className="bg-[#e9ddff] text-[#5f2ec8]">{division}</BadgePill>
              {age !== null ? <span className="text-base text-[#5f7090]">Age {age}</span> : null}
              {citizenship ? (
                <BadgePill className="bg-[#d6f6e8] text-[#0d7b5f]">{citizenship}</BadgePill>
              ) : null}
              <BadgePill
                className={
                  isCitizenshipVerified
                    ? "bg-[#d6f6e8] text-[#0d7b5f]"
                    : "bg-[#ffe1e1] text-[#b42318]"
                }
              >
                {isCitizenshipVerified
                  ? "Citizenship Verified"
                  : "Citizenship Unverified"}
              </BadgePill>
              {mediaRelease ? (
                <BadgePill className="bg-[#ccf5ef] text-[#0b7c74]">
                  {hasMediaConsent ? "Media Release: Consented" : "Media Release: Review"}
                </BadgePill>
              ) : null}
            </div>

            <p className="text-base text-[#5f7090]">{valueOrDash(hometown)}</p>
            <p className="text-sm text-[#7c6b9f]">{application.applicant.email}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.55fr,0.95fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-bold tracking-wide text-[#5f7090]">CONTACT & PERSONAL</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <DetailTile label="Email" value={valueOrDash(application.applicant.email)} />
              <DetailTile label="Phone" value={formatTraditionalPhone(application.phone)} />
              <DetailTile label="Date of Birth" value={formatDate(application.dateOfBirth)} />
              <DetailTile
                label="Address"
                value={
                  [application.address, application.city, application.state, application.zip]
                    .filter((part) => part && part.trim().length > 0)
                    .join(", ") || "--"
                }
              />
              <DetailTile label="Alt Contact" value={valueOrDash(altContact)} />
              <DetailTile label="Alt Phone / Email" value={formatPhoneOrEmail(altPhoneOrEmail)} />
              <DetailTile
                label="Citizenship Proof"
                value={citizenshipDocumentUrl ? "Document available" : "No document link found"}
              />
            </div>
            {citizenshipDocumentUrl ? (
              <a
                href={citizenshipDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]"
              >
                View citizenship proof document
              </a>
            ) : null}
            {intakeResourceUrls.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7f6aa9]">
                  Additional Intake Resources
                </p>
                <div className="flex flex-col gap-1">
                  {intakeResourceUrls.map((resourceUrl, index) => (
                    <a
                      key={`${resourceUrl}-${index}`}
                      href={resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex w-fit rounded-lg border border-[#c7b6e5] bg-white px-3 py-1.5 text-sm font-semibold text-[#5f2ec8] hover:bg-[#f3ecff]"
                    >
                      View intake resource {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-bold tracking-wide text-[#5f7090]">EDUCATION</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <DetailTile label="School" value={valueOrDash(application.schoolName)} />
              <DetailTile label="Major" value={valueOrDash(application.major)} />
              <DetailTile
                label="Status"
                value={
                  findRaw(rawCsv, ["status", "enrollment", "student status", "in college"]) ||
                  "--"
                }
              />
              <DetailTile
                label="High School / College"
                value={
                  [application.highSchoolName, application.collegeName]
                    .filter((part) => part && part.trim().length > 0)
                    .join(" / ") || "--"
                }
              />
            </div>
          </section>

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-bold tracking-wide text-[#5f7090]">BIO</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#33435e]">
              {valueOrDash(application.bio)}
            </p>

            <h3 className="mt-5 text-base font-bold tracking-wide text-[#5f7090]">CAREER PLANS</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#33435e]">
              {valueOrDash(application.careerPlans)}
            </p>

            <h3 className="mt-5 text-base font-bold tracking-wide text-[#5f7090]">USE OF FUNDS</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#33435e]">
              {valueOrDash(application.scholarshipUse)}
            </p>
          </section>

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-bold tracking-wide text-[#5f7090]">REPERTOIRE</h2>
            {repertoirePieces.length === 0 ? (
              <p className="mt-2 text-sm text-[#6a7894]">No repertoire provided.</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-relaxed text-[#33435e]">
                {repertoirePieces.map((piece, index) => (
                  <li key={`${piece.raw}-${index}`}> 
                    {piece.title}
                    {piece.composer ? ` - ${piece.composer}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 border-t border-[#e5dbf3] pt-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold tracking-wide text-[#5f7090]">VIDEOS</h3>
                {application.youtubePlaylist ? (
                  <a
                    href={application.youtubePlaylist}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-[#4d2d91] bg-[#5f2ec8] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5327b2]"
                  >
                    Open YouTube Playlist
                  </a>
                ) : null}
              </div>

              <div className="mt-3 space-y-2">
                {videoItems.length === 0 ? (
                  <p className="text-sm text-[#6d5b91]">No video links found.</p>
                ) : (
                  videoItems.map((video, index) => (
                    <div key={`video-${index}`} className="rounded-lg border border-[#d7cde9] bg-[#f8f4ff] p-3">
                      <p className="text-sm font-semibold text-[#4a3d6b]">
                        {video.title || `Video ${index + 1}`}
                      </p>
                      {video.url ? (
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-sm text-[#5f2ec8] underline"
                        >
                          {video.url}
                        </a>
                      ) : (
                        <p className="mt-1 text-sm text-[#6d5b91]">No URL</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {hasMediaConsent ? (
                <p className="mt-3 text-xs text-[#3e7c67]">
                  Media Release: Applicant consented to recording/photo use.
                </p>
              ) : mediaRelease ? (
                <p className="mt-3 text-xs text-[#6d5b91]">Media Release: {mediaRelease}</p>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          {canEditProfile ? (
            <ApplicationProfileEditor
              applicationId={application.id}
              initialApplicantName={application.applicant.name}
              initialChapter={application.chapter ?? ""}
              initialAdminNote={adminProfileNote}
              initialVideo1Title={application.video1Title ?? ""}
              initialVideo1Url={application.video1Url ?? ""}
              initialVideo2Title={application.video2Title ?? ""}
              initialVideo2Url={application.video2Url ?? ""}
              initialVideo3Title={application.video3Title ?? ""}
              initialVideo3Url={application.video3Url ?? ""}
              initialCitizenship={citizenship ?? ""}
              initialCitizenshipDocumentUrl={citizenshipDocumentUrl ?? ""}
              initialCitizenshipVerified={citizenshipVerification?.verified ?? false}
              canEditChapter={hasRole(session, "ADMIN", "NATIONAL_CHAIR")}
            />
          ) : null}

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-semibold text-[#1e1538]">Status & Actions</h2>
            <div className="mt-3 space-y-3">
              {bypassAuditEvent ? (
                <div className="rounded-lg border border-[#e3c88a] bg-[#fff8e7] p-2.5 text-sm text-[#6a4a00]">
                  <p className="font-semibold">Forwarded (Bypassed Chapter Adjudication)</p>
                  <p className="mt-1 text-xs">
                    {new Date(bypassAuditEvent.at).toLocaleString("en-US")} ·{" "}
                    {bypassAuditEvent.actorRole}
                  </p>
                  {bypassAuditEvent.reason ? (
                    <p className="mt-1 text-xs">Reason: {bypassAuditEvent.reason}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
                  Current Status
                </p>
                <div className="mt-2">
                  <ApplicationStatusBadge status={application.status} />
                </div>
              </div>
              <div className="rounded-lg border border-[#e2d8f0] bg-[#faf7ff] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7b6e9d]">
                  Workflow Actions
                </p>
                <div className="mt-2 space-y-2">
                  {!isCitizenshipVerified ? (
                    <div className="rounded-md border border-[#f2b2b2] bg-[#fff2f2] p-2 text-xs font-semibold text-[#b42318]">
                      Citizenship verification is required before advancing this application.
                    </div>
                  ) : null}
                  {canForwardToNationalsBypass ? (
                    <ForwardToNationalsButton
                      applicationId={application.id}
                      disabledByCitizenship={!isCitizenshipVerified}
                    />
                  ) : null}
                  {canSeeStatusActions ? (
                    <AdvanceApplicationStatusButtons
                      applicationId={application.id}
                      currentStatus={application.status}
                      allowOverrideAll={canOverrideAllStatuses}
                      citizenshipVerified={isCitizenshipVerified}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You do not have permission to change this status.
                    </p>
                  )}
                </div>
              </div>
              {chapterGateMessage ? (
                <p className="text-xs text-muted-foreground">{chapterGateMessage}</p>
              ) : null}
              {canDeleteApplication ? (
                <details className="rounded-lg border border-[#eed7d7] bg-[#fff8f8] p-3">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-[#a04949]">
                    Danger Zone
                  </summary>
                  <div className="mt-3">
                    <DeleteApplicationButton applicationId={application.id} />
                  </div>
                </details>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-semibold text-[#1e1538]">Timeline</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {timeline.map((status, index) => (
                <li key={`${status}-${index}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#6a42b8]" />
                  <ApplicationStatusBadge status={status} />
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border border-[#d8cce9] bg-white p-3.5">
            <h2 className="text-lg font-semibold text-[#1e1538]">Scores</h2>
            {application.scores.length === 0 ? (
              <p className="mt-3 text-sm text-[#6d5b91]">No scores submitted yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {application.scores.map((score) => (
                  <div key={score.id} className="rounded-lg border border-[#d7cde9] p-2 text-sm">
                    <p className="font-semibold text-[#2b2350]">{score.criteria.name}</p>
                    <p className="text-[#6d5b91]">
                      {score.judge.name} ({score.judge.role.toLowerCase()})
                    </p>
                    <p className="font-semibold text-[#2b2350]">{score.value.toFixed(1)} / 10</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
