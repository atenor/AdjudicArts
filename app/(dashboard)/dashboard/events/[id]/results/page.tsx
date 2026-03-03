export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { getResultsSummaryForEvent } from "@/lib/db/results";
import {
  getAudienceFavoriteLeaderboard,
  listChairPrizeAllocationsForRound,
  listJudgePrizeSuggestionsForRound,
} from "@/lib/db/governance";
import EventStatusBadge from "@/components/events/event-status-badge";
import RoundResultsTabs from "@/components/results/round-results-tabs";
import styles from "./results.module.css";

export default async function EventResultsPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR", "CHAPTER_CHAIR")) redirect("/dashboard");

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) notFound();

  const allRoundSummaries = await getResultsSummaryForEvent(event.id);
  const roundSummaries =
    session.user.role === "CHAPTER_CHAIR"
      ? allRoundSummaries.filter((round) => round.roundType === "CHAPTER")
      : allRoundSummaries;
  const governanceByRound = Object.fromEntries(
    await Promise.all(
      roundSummaries.map(async (round) => {
        const [chairAllocations, judgeSuggestions, audienceFavorite] = await Promise.all([
          listChairPrizeAllocationsForRound({
            organizationId: session.user.organizationId,
            roundId: round.roundId,
          }),
          listJudgePrizeSuggestionsForRound({
            organizationId: session.user.organizationId,
            roundId: round.roundId,
          }),
          getAudienceFavoriteLeaderboard({
            organizationId: session.user.organizationId,
            roundId: round.roundId,
          }),
        ]);

        return [
          round.roundId,
          {
            chairAllocations: chairAllocations.map((allocation) => ({
              applicationId: allocation.applicationId,
              applicantName: allocation.application.applicant.name,
              label: allocation.label,
              amountCents: allocation.amountCents,
              internalNote: allocation.internalNote,
              createdByName: allocation.createdBy.name ?? allocation.createdBy.email,
              createdAt: allocation.createdAt,
            })),
            judgeSuggestions: judgeSuggestions.map((suggestion) => ({
              applicationId: suggestion.applicationId,
              applicantName: suggestion.application.applicant.name,
              judgeName: suggestion.judge.name ?? suggestion.judge.email,
              label: suggestion.label,
              amountCents: suggestion.amountCents,
              comment: suggestion.comment,
            })),
            audienceFavorite,
          },
        ] as const;
      })
    )
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Results — {event.name}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className={styles.subtext}>
            Rankings by total average score across all judges and criteria.
          </p>
        </div>
      </header>

      <RoundResultsTabs
        eventId={event.id}
        rounds={roundSummaries}
        governanceByRound={governanceByRound}
        viewerRole={session.user.role}
        viewerChapter={session.user.chapter ?? null}
      />

      <Link href={`/dashboard/events/${event.id}`} className={styles.backLink}>
        ← Back to event
      </Link>
    </div>
  );
}
