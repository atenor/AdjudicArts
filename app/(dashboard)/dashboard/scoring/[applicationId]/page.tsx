export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getScoringApplicationForJudge } from "@/lib/db/scores";
import { formatVoicePart } from "@/lib/application-metadata";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import ScoringForm from "@/components/judging/scoring-form";
import StickyVideoPlayer from "@/components/judging/sticky-video-player";

export default async function ScoreApplicationPage({
  params,
}: {
  params: { applicationId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    redirect("/dashboard");
  }

  const scoringContext = await getScoringApplicationForJudge(
    params.applicationId,
    session.user.id,
    session.user.organizationId,
    session.user.role
  );

  if (!scoringContext) notFound();

  const { application, criteria, existingScores, finalComment, videoUrls } =
    scoringContext;

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:space-y-0">
      <aside className="lg:col-span-5 space-y-4">
        <StickyVideoPlayer videoUrls={videoUrls} />
      </aside>

      <div className="lg:col-span-7 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{application.applicant.name}</h1>
          <p className="text-sm text-muted-foreground">{application.applicant.email}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="font-medium">Application</h2>
            <p className="text-sm">
              <span className="text-muted-foreground">Event:</span> {application.event.name}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Voice Part:</span>{" "}
              {formatVoicePart(application.notes)}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Status:</span>{" "}
              <ApplicationStatusBadge status={application.status} />
            </p>
          </section>
          <section className="rounded-lg border p-4 space-y-2">
            <h2 className="font-medium">Repertoire</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {application.repertoire || "No repertoire provided."}
            </p>
          </section>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-medium">Rubric Scores</h2>
          <ScoringForm
            applicationId={application.id}
            criteria={criteria}
            existingFinalComment={finalComment}
            existingScores={existingScores.map((score) => ({
              criteriaId: score.criteriaId,
              value: score.value,
              comment: score.comment,
            }))}
          />
        </section>

        <Link
          href="/dashboard/scoring"
          className="inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Back to scoring queue
        </Link>
      </div>
    </div>
  );
}
