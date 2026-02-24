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
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function valueOrDash(value: string | null | undefined) {
  if (!value || value.trim().length === 0) return "—";
  return value;
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

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/applications"
        className="inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to applications
      </Link>

      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getDisplayHeadshot(application.headshot, application.id)}
          alt={`${application.applicant.name} headshot`}
          className="h-14 w-14 rounded-full object-cover border border-border/70 bg-muted"
          loading="lazy"
        />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{application.applicant.name}</h1>
          <p className="text-sm text-muted-foreground">{application.applicant.email}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Application Details</h2>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Event:</span>{" "}
              <Link href={`/dashboard/events/${application.event.id}`} className="hover:underline">
                {application.event.name}
              </Link>
            </p>
            <p>
              <span className="text-muted-foreground">Voice Part:</span>{" "}
              {formatVoicePart(application.notes)}
            </p>
            <p>
              <span className="text-muted-foreground">Repertoire:</span>{" "}
            </p>
            {repertoirePieces.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {repertoirePieces.map((piece, index) => (
                  <li key={`${piece.raw}-${index}`}>
                    <p className="font-medium">{piece.title}</p>
                    {piece.composer || piece.poet || piece.detail ? (
                      <p className="text-xs text-muted-foreground">
                        {piece.composer ? `Composer: ${piece.composer}` : ""}
                        {piece.poet ? `${piece.composer ? " · " : ""}Poet: ${piece.poet}` : ""}
                        {piece.detail
                          ? `${piece.composer || piece.poet ? " · " : ""}${piece.detail}`
                          : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            <p>
              <span className="text-muted-foreground">Submitted:</span>{" "}
              {application.submittedAt.toLocaleString("en-US")}
            </p>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Status</h2>
          <ApplicationStatusBadge status={application.status} />
          <AdvanceApplicationStatusButtons
            applicationId={application.id}
            currentStatus={application.status}
          />
          <div className="pt-1">
            <DeleteApplicationButton applicationId={application.id} />
          </div>
        </section>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Profile Information</h2>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-1.5">
            <p>
              <span className="text-muted-foreground">Chapter:</span>{" "}
              {valueOrDash(application.chapter)}
            </p>
            <p>
              <span className="text-muted-foreground">Date of Birth:</span>{" "}
              {formatDateOfBirth(application.dateOfBirth)}
            </p>
            <p>
              <span className="text-muted-foreground">Gender:</span>{" "}
              {valueOrDash(application.gender)}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              {valueOrDash(application.phone)}
            </p>
          </div>
          <div className="space-y-1.5">
            <p>
              <span className="text-muted-foreground">Address:</span>{" "}
              {valueOrDash(application.address)}
            </p>
            <p>
              <span className="text-muted-foreground">City:</span>{" "}
              {valueOrDash(application.city)}
            </p>
            <p>
              <span className="text-muted-foreground">State:</span>{" "}
              {valueOrDash(application.state)}
            </p>
            <p>
              <span className="text-muted-foreground">ZIP:</span>{" "}
              {valueOrDash(application.zip)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Education</h2>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-1.5">
            <p>
              <span className="text-muted-foreground">School Name:</span>{" "}
              {valueOrDash(application.schoolName)}
            </p>
            <p>
              <span className="text-muted-foreground">School City:</span>{" "}
              {valueOrDash(application.schoolCity)}
            </p>
            <p>
              <span className="text-muted-foreground">School State:</span>{" "}
              {valueOrDash(application.schoolState)}
            </p>
          </div>
          <div className="space-y-1.5">
            <p>
              <span className="text-muted-foreground">High School:</span>{" "}
              {valueOrDash(application.highSchoolName)}
            </p>
            <p>
              <span className="text-muted-foreground">College/University:</span>{" "}
              {valueOrDash(application.collegeName)}
            </p>
            <p>
              <span className="text-muted-foreground">Major:</span>{" "}
              {valueOrDash(application.major)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Submission Narrative</h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Career Plans:</span>{" "}
            {valueOrDash(application.careerPlans)}
          </p>
          <p>
            <span className="text-muted-foreground">Scholarship Use:</span>{" "}
            {valueOrDash(application.scholarshipUse)}
          </p>
          <p>
            <span className="text-muted-foreground">Bio:</span>{" "}
            {valueOrDash(application.bio)}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Parent / Guardian</h2>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <p>
            <span className="text-muted-foreground">Name:</span>{" "}
            {valueOrDash(application.parentName)}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {valueOrDash(application.parentEmail)}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Video Assets</h2>
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

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Status Timeline</h2>
        <ol className="space-y-2 text-sm">
          {timeline.map((status, index) => (
            <li key={`${status}-${index}`} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <ApplicationStatusBadge status={status} />
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Scores</h2>
        {application.scores.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scores submitted yet.</p>
        ) : (
          <div className="space-y-2">
            {application.scores.map((score) => (
              <div
                key={score.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
              >
                <div>
                  <p className="font-medium">{score.criteria.name}</p>
                  <p className="text-muted-foreground">
                    Judge: {score.judge.name} ({score.judge.role.toLowerCase()})
                  </p>
                </div>
                <p className="font-semibold">{score.value.toFixed(1)} / 10</p>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
