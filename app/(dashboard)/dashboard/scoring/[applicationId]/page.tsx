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
import {
  ApplicationDivision,
  formatDivisionLabel,
  getCompetitionCutoffDate,
  resolveApplicationDivision,
} from "@/lib/application-division";
import { getDisplayHeadshot } from "@/lib/headshots";
import { parseRepertoireEntries } from "@/lib/repertoire";
import ScoringForm from "@/components/judging/scoring-form";
import StickyVideoPlayer from "@/components/judging/sticky-video-player";
import JudgeBookmarkButton from "@/components/judging/favourite-button";
import HeadshotPreview from "@/components/shared/headshot-preview";
import styles from "./scoring.module.css";

function getAgeAtDate(dateOfBirth: Date | null | undefined, atDate: Date): number | null {
  if (!dateOfBirth) return null;
  let age = atDate.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = atDate.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && atDate.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

export default async function ScoreApplicationPage({
  params,
  searchParams,
}: {
  params: { applicationId: string };
  searchParams: {
    division?: string;
    view?: string;
    voicePart?: string;
    sort?: string;
    bookmarks?: string;
    layout?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE")) {
    redirect("/dashboard");
  }

  const requestedDivision: ApplicationDivision | undefined =
    searchParams.division === "16-18" || searchParams.division === "19-22"
      ? searchParams.division
      : undefined;
  const queueParams = new URLSearchParams();
  if (searchParams.division) queueParams.set("division", searchParams.division);
  if (searchParams.view) queueParams.set("view", searchParams.view);
  if (searchParams.voicePart) queueParams.set("voicePart", searchParams.voicePart);
  if (searchParams.sort) queueParams.set("sort", searchParams.sort);
  if (searchParams.bookmarks) queueParams.set("bookmarks", searchParams.bookmarks);
  if (searchParams.layout) queueParams.set("layout", searchParams.layout);
  const queueHref = queueParams.toString()
    ? `/dashboard/scoring?${queueParams.toString()}`
    : "/dashboard/scoring";

  const [scoringContext, judgingList] = await Promise.all([
    getScoringApplicationForJudge(
      params.applicationId,
      session.user.id,
      session.user.organizationId,
      session.user.role,
      session.user.chapter
    ),
    getJudgeScoringQueue(session.user.id, session.user.organizationId, session.user.role, {
      division: requestedDivision,
      userChapter: session.user.chapter,
    }),
  ]);

  if (!scoringContext) notFound();

  const {
    application,
    criteria,
    existingScores,
    finalComment,
    submission,
    certification,
    isBookmarked,
    prizeSuggestions,
    videoUrls,
    videoTitles,
  } = scoringContext;

  const repertoirePieces = parseRepertoireEntries(application.repertoire);
  const competitionDate = getCompetitionCutoffDate({
    openAt: application.event.openAt,
    closeAt: application.event.closeAt,
  });
  const ageAtCompetition = getAgeAtDate(application.dateOfBirth, competitionDate);
  const applicantDivision = resolveApplicationDivision({
    notes: application.notes,
    dateOfBirth: application.dateOfBirth,
    competitionDate,
  });
  const divisionLabel = formatDivisionLabel(applicantDivision);
  const schoolName = application.schoolName?.trim() || "";
  const schoolLocation = [application.schoolCity, application.schoolState]
    .map((value) => value?.trim() || "")
    .filter(Boolean)
    .join(", ");
  const schoolLabel = schoolName
    ? schoolLocation
      ? `${schoolName} (${schoolLocation})`
      : schoolName
    : "School not provided";
  const visibleVideoTitles = videoTitles
    .map((title, index) => ({
      label: `Video ${index + 1}`,
      title: title?.trim() || `Audition Video ${index + 1}`,
    }))
    .slice(0, videoUrls.length);
  const chapterPrizeSuggestionsEnabled =
    process.env.ENABLE_CHAPTER_PRIZE_SUGGESTIONS === "true";
  const canSuggestPrizes =
    session.user.role === "NATIONAL_JUDGE" || chapterPrizeSuggestionsEnabled;
  const initialFilledCount = existingScores.length;
  const initialScoreTotal = existingScores.reduce((sum, score) => sum + score.value, 0);
  const initialMaxScore = Math.max(criteria.length * 10, 1);
  const initialNormalizedTotal = Math.round((initialScoreTotal / initialMaxScore) * 100);
  const initialAverageScore =
    initialFilledCount > 0 ? Math.round(initialScoreTotal / initialFilledCount) : 0;

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
      <section className={styles.applicantHeader}>
        <HeadshotPreview
          src={getDisplayHeadshot(application.headshot, application.id)}
          alt={`${application.applicant.name} headshot`}
          triggerClassName={styles.avatar}
        />
        <div className={styles.identityBlock}>
          <div className={styles.primaryRow}>
            <h1 className={styles.name}>{application.applicant.name}</h1>
            <p className={styles.nameMetaInline}>
              {ageAtCompetition === null ? "Age N/A" : `Age ${ageAtCompetition}`} · {divisionLabel}
            </p>
          </div>
          <p className={styles.meta}>{schoolLabel}</p>
        </div>
        <div className={styles.bookmarkBlock}>
          <JudgeBookmarkButton
            applicationId={application.id}
            initialActive={isBookmarked}
          />
        </div>
      </section>

      <div className={styles.grid}>
        <div className={styles.left}>
          <section>
            <ScoringForm
              applicationId={application.id}
              applicantName={application.applicant.name}
              judgeName={session.user.name ?? "Adjudication Judge"}
              canSuggestPrizes={canSuggestPrizes}
              previousApplicantHref={
                previousApplication
                  ? requestedDivision
                    ? `/dashboard/scoring/${previousApplication.id}?division=${requestedDivision}`
                    : `/dashboard/scoring/${previousApplication.id}`
                  : null
              }
              nextApplicantHref={
                nextApplication
                  ? requestedDivision
                    ? `/dashboard/scoring/${nextApplication.id}?division=${requestedDivision}`
                    : `/dashboard/scoring/${nextApplication.id}`
                  : null
              }
              criteria={criteria}
              submission={submission}
              certification={certification}
              initialPrizeSuggestions={prizeSuggestions}
              existingFinalComment={finalComment}
              existingScores={existingScores.map((score) => ({
                criteriaId: score.criteriaId,
                value: score.value,
                comment: score.comment,
              }))}
            />
          </section>

          <Link href={queueHref} className={styles.backLink}>
            ← Back to adjudication list
          </Link>
        </div>

        <aside className={styles.right}>
          <div className={styles.stickyPanel}>
            <StickyVideoPlayer
              videoUrls={videoUrls}
              videoTitles={visibleVideoTitles.map((video) => video.title)}
              repertoireEntries={repertoirePieces}
              performerName={application.applicant.name}
              performerMeta={`${ageAtCompetition === null ? "Age N/A" : `Age ${ageAtCompetition}`} · ${divisionLabel}`}
              initialScoreSummary={{
                filled: initialFilledCount,
                totalCriteria: criteria.length,
                average: initialAverageScore,
                normalizedTotal: initialNormalizedTotal,
              }}
            />

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
                    href={
                      requestedDivision
                        ? `/dashboard/scoring/${previousApplication.id}?division=${requestedDivision}`
                        : `/dashboard/scoring/${previousApplication.id}`
                    }
                    className={styles.navLink}
                  >
                    Prev
                  </Link>
                ) : (
                  <span className={styles.navLink}>Prev</span>
                )}

                {nextApplication ? (
                  <Link
                    href={
                      requestedDivision
                        ? `/dashboard/scoring/${nextApplication.id}?division=${requestedDivision}`
                        : `/dashboard/scoring/${nextApplication.id}`
                    }
                    className={styles.navLink}
                  >
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
