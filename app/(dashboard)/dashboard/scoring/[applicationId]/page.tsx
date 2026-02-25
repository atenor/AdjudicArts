export const dynamic = "force-dynamic";

import Link from "next/link";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import {
  getJudgeScoringQueue,
  getScoringApplicationForJudge,
} from "@/lib/db/scores";
import { formatVoicePart } from "@/lib/application-metadata";
import { getDisplayHeadshot } from "@/lib/headshots";
import { parseRepertoireEntries } from "@/lib/repertoire";
import ApplicationStatusBadge from "@/components/applications/application-status-badge";
import ScoringForm from "@/components/judging/scoring-form";
import StickyVideoPlayer from "@/components/judging/sticky-video-player";
import FavouriteButton from "@/components/judging/favourite-button";
import styles from "./scoring.module.css";

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

  const [scoringContext, judgingList] = await Promise.all([
    getScoringApplicationForJudge(
      params.applicationId,
      session.user.id,
      session.user.organizationId,
      session.user.role
    ),
    getJudgeScoringQueue(session.user.id, session.user.organizationId, session.user.role),
  ]);

  if (!scoringContext) notFound();

  const {
    application,
    criteria,
    existingScores,
    finalComment,
    videoUrls,
    videoTitles,
  } = scoringContext;

  const repertoirePieces = parseRepertoireEntries(application.repertoire);
  const visibleVideoTitles = videoTitles
    .map((title, index) => ({
      label: `Video ${index + 1}`,
      title: title?.trim() || `Audition Video ${index + 1}`,
    }))
    .slice(0, videoUrls.length);

  const queueApplications = judgingList.flatMap((roundQueue) =>
    roundQueue.applications.map((queueApp) => ({
      id: queueApp.id,
      name: queueApp.applicant.name,
      roundName: roundQueue.round.name,
      eventName: roundQueue.event.name,
    }))
  );

  const currentIndex = queueApplications.findIndex(
    (queueApp) => queueApp.id === application.id
  );

  const hasNeighbors = queueApplications.length > 1 && currentIndex >= 0;
  const previousApplication = hasNeighbors
    ? queueApplications[
        (currentIndex - 1 + queueApplications.length) % queueApplications.length
      ]
    : null;
  const nextApplication = hasNeighbors
    ? queueApplications[(currentIndex + 1) % queueApplications.length]
    : null;

  return (
    <div className={styles.page}>
      <div className={styles.grid}>
        <div className={styles.left}>
          <section className={styles.applicantHeader}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getDisplayHeadshot(application.headshot, application.id)}
              alt={`${application.applicant.name} headshot`}
              className={styles.avatar}
              loading="lazy"
            />
            <div>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{application.applicant.name}</h1>
                <FavouriteButton />
              </div>
              <p className={styles.email}>{application.applicant.email}</p>
              <p className={styles.meta}>
                {formatVoicePart(application.notes)}
                {application.chapter ? ` · ${application.chapter}` : ""}
              </p>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>Application</div>
            <div className={styles.cardBody}>
              <p className={styles.bodyRow}>
                <span className={styles.bodyLabel}>Event:</span> {application.event.name}
              </p>
              <p className={styles.bodyRow}>
                <span className={styles.bodyLabel}>Voice Part:</span> {formatVoicePart(application.notes)}
              </p>
              <p className={styles.bodyRow}>
                <span className={styles.bodyLabel}>Status:</span>{" "}
                <ApplicationStatusBadge status={application.status} />
              </p>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.sectionHeader}>Repertoire</div>
            <div className={styles.cardBody}>
              {repertoirePieces.length === 0 ? (
                <p className={styles.bodyRow}>No repertoire provided.</p>
              ) : (
                <ol className={styles.repertoire}>
                  {repertoirePieces.map((piece, index) => (
                    <li key={`${piece.raw}-${index}`} className={styles.repertoireItem}>
                      <span className={styles.repertoireTitle}>{piece.title}</span>
                      {piece.composer || piece.poet || piece.detail ? (
                        <span className={styles.repertoireMeta}>
                          {piece.composer ? `Composer: ${piece.composer}` : ""}
                          {piece.poet ? `${piece.composer ? " · " : ""}Poet: ${piece.poet}` : ""}
                          {piece.detail
                            ? `${piece.composer || piece.poet ? " · " : ""}${piece.detail}`
                            : ""}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>Rubric Scores</div>
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

          <Link href="/dashboard/scoring" className={styles.backLink}>
            ← Back to judging list
          </Link>
        </div>

        <aside className={styles.right}>
          <div className={styles.stickyPanel}>
            <StickyVideoPlayer videoUrls={videoUrls} />

            {visibleVideoTitles.length > 0 ? (
              <section className={`${styles.sidebarCard} ${styles.desktopOnly}`}>
                <h2 className={styles.sidebarTitle}>Video Titles</h2>
                <ol className={styles.videoTitleList}>
                  {visibleVideoTitles.map((video) => (
                    <li key={`${video.label}-${video.title}`}>
                      <strong>{video.label}:</strong> {video.title}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className={`${styles.sidebarCard} ${styles.desktopOnly}`}>
              <h2 className={styles.sidebarTitle}>Judging List Navigation</h2>
                <p className={styles.navMeta}>
                  {currentIndex >= 0
                    ? `${currentIndex + 1} of ${queueApplications.length} applicants`
                    : "Current applicant not found in judging list order."}
                </p>
              <div className={styles.navLinks}>
                {previousApplication ? (
                  <Link
                    href={`/dashboard/scoring/${previousApplication.id}`}
                    className={styles.navLink}
                  >
                    Prev
                  </Link>
                ) : (
                  <span className={styles.navLink}>Prev</span>
                )}

                {nextApplication ? (
                  <Link href={`/dashboard/scoring/${nextApplication.id}`} className={styles.navLink}>
                    Next
                  </Link>
                ) : (
                  <span className={styles.navLink}>Next</span>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
