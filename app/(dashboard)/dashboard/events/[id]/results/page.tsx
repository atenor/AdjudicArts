export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { getResultsSummaryForEvent } from "@/lib/db/results";
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
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) notFound();

  const roundSummaries = await getResultsSummaryForEvent(event.id);

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

      <RoundResultsTabs eventId={event.id} rounds={roundSummaries} />

      <Link href={`/dashboard/events/${event.id}`} className={styles.backLink}>
        ← Back to event
      </Link>
    </div>
  );
}
