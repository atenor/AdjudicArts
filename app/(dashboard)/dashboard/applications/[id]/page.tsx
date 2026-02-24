export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ApplicationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getApplicationById } from "@/lib/db/applications";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import AdvanceApplicationStatusButtons from "@/components/applications/advance-application-status-buttons";
import DeleteApplicationButton from "@/components/applications/delete-application-button";
import { formatVoicePart } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import { parseRepertoireEntries } from "@/lib/repertoire";

type RawCsv = Record<string, string>;

const STATUS_FLOW: ApplicationStatus[] = [
  "SUBMITTED",
  "CHAPTER_REVIEW",
  "CHAPTER_APPROVED",
  "NATIONAL_REVIEW",
  "NATIONAL_APPROVED",
  "DECIDED",
];

function deriveStatusTimeline(status: ApplicationStatus): ApplicationStatus[] {
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

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#d7cde9] bg-[#f8f4ff] p-4">
      <p className="text-sm font-medium text-[#7b6e9d]">{label}</p>
      <p className="mt-1 text-xl leading-snug text-[#1e1538]">{value}</p>
    </div>
  );
}

function BadgePill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-lg font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  const application = await getApplicationById(params.id, session.user.organizationId);
  if (!application) notFound();

  const timeline = deriveStatusTimeline(application.status);
  const repertoirePieces = parseRepertoireEntries(application.repertoire);
  const rawCsv = getImportedRawCsv(application.notes);
  const age = getAge(application.dateOfBirth);

  const division =
    findRaw(rawCsv, ["division", "age group", "category", "voice part"]) ??
    formatVoicePart(application.notes);
  const citizenship = findRaw(rawCsv, ["citizen", "citizenship", "resident"]);
  const mediaRelease = findRaw(rawCsv, ["media release", "photo release", "release"]);
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
    <div className="space-y-6 pb-10">
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

      <section className="rounded-2xl border border-[#d8cce9] bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[10.5rem,1fr]">
          <Link
            href={headshotUrl}
            target="_blank"
            rel="noreferrer"
            className="group block"
            title="Open full-size headshot"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={headshotUrl}
              alt={`${application.applicant.name} headshot`}
              className="h-[13rem] w-[10.5rem] rounded-3xl border-2 border-[#cbb7e8] object-cover shadow-md transition group-hover:scale-[1.02]"
              loading="lazy"
            />
            <p className="mt-2 text-xs font-medium text-[#7f6aa9]">Open full-size photo</p>
          </Link>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-5xl font-extrabold tracking-tight text-[#1a1735]">
                {application.applicant.name}
              </h1>
              <span className="text-4xl text-[#c7b7e5]">☆</span>
            </div>

            <p className="text-2xl text-[#5f7090]">
              {valueOrDash(application.chapter)} Chapter
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <BadgePill className="bg-[#e9ddff] text-[#5f2ec8]">{division}</BadgePill>
              {age !== null ? <span className="text-4xl text-[#5f7090]">Age {age}</span> : null}
              {citizenship ? (
                <BadgePill className="bg-[#d6f6e8] text-[#0d7b5f]">{citizenship}</BadgePill>
              ) : null}
              {mediaRelease ? (
                <BadgePill className="bg-[#ccf5ef] text-[#0b7c74]">{mediaRelease}</BadgePill>
              ) : null}
            </div>

            <p className="text-4xl text-[#5f7090]">{valueOrDash(hometown)}</p>
            <p className="text-lg text-[#7c6b9f]">{application.applicant.email}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr,0.95fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-4xl font-bold tracking-wide text-[#5f7090]">CONTACT & PERSONAL</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <DetailTile label="Email" value={valueOrDash(application.applicant.email)} />
              <DetailTile label="Phone" value={valueOrDash(application.phone)} />
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
              <DetailTile label="Alt Phone / Email" value={valueOrDash(altPhoneOrEmail)} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-4xl font-bold tracking-wide text-[#5f7090]">EDUCATION</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
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

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-4xl font-bold tracking-wide text-[#5f7090]">BIO</h2>
            <p className="mt-3 whitespace-pre-wrap text-xl leading-relaxed text-[#33435e]">
              {valueOrDash(application.bio)}
            </p>

            <h3 className="mt-8 text-3xl font-bold tracking-wide text-[#5f7090]">CAREER PLANS</h3>
            <p className="mt-2 whitespace-pre-wrap text-xl leading-relaxed text-[#33435e]">
              {valueOrDash(application.careerPlans)}
            </p>

            <h3 className="mt-8 text-3xl font-bold tracking-wide text-[#5f7090]">USE OF FUNDS</h3>
            <p className="mt-2 whitespace-pre-wrap text-xl leading-relaxed text-[#33435e]">
              {valueOrDash(application.scholarshipUse)}
            </p>
          </section>

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-4xl font-bold tracking-wide text-[#5f7090]">REPERTOIRE</h2>
            {repertoirePieces.length === 0 ? (
              <p className="mt-3 text-xl text-[#6a7894]">No repertoire provided.</p>
            ) : (
              <ul className="mt-3 list-disc space-y-2 pl-7 text-4 leading-relaxed text-[#33435e]">
                {repertoirePieces.map((piece, index) => (
                  <li key={`${piece.raw}-${index}`}> 
                    {piece.title}
                    {piece.composer ? ` - ${piece.composer}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#1e1538]">Status & Actions</h2>
            <div className="mt-3 space-y-3">
              <ApplicationStatusBadge status={application.status} />
              <AdvanceApplicationStatusButtons
                applicationId={application.id}
                currentStatus={application.status}
              />
              <DeleteApplicationButton applicationId={application.id} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
            <h2 className="text-lg font-semibold text-[#1e1538]">Videos</h2>
            <div className="mt-3 space-y-3">
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
            {application.youtubePlaylist ? (
              <a
                href={application.youtubePlaylist}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg border border-[#c7b7e5] px-3 py-2 text-sm font-semibold text-[#4a3d6b] hover:bg-[#f4effb]"
              >
                Open YouTube Playlist
              </a>
            ) : null}
          </section>

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
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

          <section className="rounded-2xl border border-[#d8cce9] bg-white p-5">
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
