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

      <Link
        href="/dashboard/applications"
        className="inline-block text-sm text-muted-foreground hover:underline"
      >
        ← Back to applications
      </Link>
    </div>
  );
}
