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

function formatDateOfBirth(value: Date | null) {
  if (!value) return "--";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function valueOrDash(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return "--";
  return value;
}

function getImportedRawCsv(notes: string | null | undefined) {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as {
      importProfile?: {
        rawCsv?: Record<string, string>;
      };
    };
    if (!parsed.importProfile?.rawCsv) return null;
    const entries = Object.entries(parsed.importProfile.rawCsv).filter(
      ([key, value]) => key.trim().length > 0 && String(value).trim().length > 0
    );
    return entries.length > 0 ? entries : null;
  } catch {
    return null;
  }
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem,1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
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
  const importedRawCsvEntries = getImportedRawCsv(application.notes);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/applications"
          className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
        >
          ← Back to applications
        </Link>
        <div className="text-sm text-muted-foreground">
          Application Submitted: {application.submittedAt.toLocaleString("en-US")}
        </div>
      </div>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getDisplayHeadshot(application.headshot, application.id)}
            alt={`${application.applicant.name} headshot`}
            className="h-20 w-20 rounded-full border object-cover"
            loading="lazy"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-3xl font-bold tracking-tight">{application.applicant.name}</h1>
            <p className="truncate text-sm text-muted-foreground">{application.applicant.email}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ApplicationStatusBadge status={application.status} />
              <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
                {formatVoicePart(application.notes)}
              </span>
              {application.chapter ? (
                <span className="rounded-full border px-2 py-0.5 text-muted-foreground">
                  {application.chapter}
                </span>
              ) : null}
            </div>
          </div>
          <div className="min-w-[14rem] rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Event</p>
            <Link href={`/dashboard/events/${application.event.id}`} className="font-semibold hover:underline">
              {application.event.name}
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.6fr,1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Repertoire</h2>
            {repertoirePieces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No repertoire provided.</p>
            ) : (
              <ol className="list-decimal space-y-3 pl-5">
                {repertoirePieces.map((piece, index) => (
                  <li key={`${piece.raw}-${index}`}>
                    <p className="font-semibold">{piece.title}</p>
                    {piece.composer || piece.poet || piece.detail ? (
                      <p className="text-sm text-muted-foreground">
                        {piece.composer ? `Composer: ${piece.composer}` : ""}
                        {piece.poet ? `${piece.composer ? " · " : ""}Poet: ${piece.poet}` : ""}
                        {piece.detail ? `${piece.composer || piece.poet ? " · " : ""}${piece.detail}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Application Narrative</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">Future Career Plans</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {valueOrDash(application.careerPlans)}
                </p>
              </article>
              <article className="rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">Scholarship Use</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {valueOrDash(application.scholarshipUse)}
                </p>
              </article>
              <article className="rounded-lg border p-3">
                <h3 className="mb-2 text-sm font-semibold">Bio</h3>
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {valueOrDash(application.bio)}
                </p>
              </article>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Imported CSV Fields</h2>
            {!importedRawCsvEntries ? (
              <p className="text-sm text-muted-foreground">No raw CSV payload captured for this record.</p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-left">
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Column</th>
                      <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importedRawCsvEntries.map(([key, value]) => (
                      <tr key={key} className="border-b align-top last:border-b-0">
                        <td className="px-3 py-2 font-medium">{key}</td>
                        <td className="px-3 py-2 whitespace-pre-wrap break-words">{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Status & Actions</h2>
            <div className="space-y-3">
              <ApplicationStatusBadge status={application.status} />
              <AdvanceApplicationStatusButtons
                applicationId={application.id}
                currentStatus={application.status}
              />
              <div className="pt-1">
                <DeleteApplicationButton applicationId={application.id} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Profile Details</h2>
            <KeyValue label="Date of Birth" value={formatDateOfBirth(application.dateOfBirth)} />
            <KeyValue label="Gender" value={valueOrDash(application.gender)} />
            <KeyValue label="Phone" value={valueOrDash(application.phone)} />
            <KeyValue label="Address" value={valueOrDash(application.address)} />
            <KeyValue label="City" value={valueOrDash(application.city)} />
            <KeyValue label="State" value={valueOrDash(application.state)} />
            <KeyValue label="ZIP" value={valueOrDash(application.zip)} />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Education</h2>
            <KeyValue label="School" value={valueOrDash(application.schoolName)} />
            <KeyValue label="School City" value={valueOrDash(application.schoolCity)} />
            <KeyValue label="School State" value={valueOrDash(application.schoolState)} />
            <KeyValue label="High School" value={valueOrDash(application.highSchoolName)} />
            <KeyValue label="College" value={valueOrDash(application.collegeName)} />
            <KeyValue label="Major" value={valueOrDash(application.major)} />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Parent / Guardian</h2>
            <KeyValue label="Name" value={valueOrDash(application.parentName)} />
            <KeyValue label="Email" value={valueOrDash(application.parentEmail)} />
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Video Assets</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Video 1:</span>{" "}
                {valueOrDash(application.video1Title)}
                {application.video1Url ? ` — ${application.video1Url}` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Video 2:</span>{" "}
                {valueOrDash(application.video2Title)}
                {application.video2Url ? ` — ${application.video2Url}` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Video 3:</span>{" "}
                {valueOrDash(application.video3Title)}
                {application.video3Url ? ` — ${application.video3Url}` : ""}
              </p>
              <p>
                <span className="text-muted-foreground">Playlist:</span>{" "}
                {valueOrDash(application.youtubePlaylist)}
              </p>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Status Timeline</h2>
            <ol className="space-y-2 text-sm">
              {timeline.map((status, index) => (
                <li key={`${status}-${index}`} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <ApplicationStatusBadge status={status} />
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-xl border bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold">Scores</h2>
            {application.scores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No scores submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {application.scores.map((score) => (
                  <div
                    key={score.id}
                    className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{score.criteria.name}</p>
                      <p className="truncate text-muted-foreground">
                        {score.judge.name} ({score.judge.role.toLowerCase()})
                      </p>
                    </div>
                    <p className="font-semibold">{score.value.toFixed(1)} / 10</p>
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
