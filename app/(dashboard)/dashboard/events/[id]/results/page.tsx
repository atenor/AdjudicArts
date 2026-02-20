export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { getResultsSummaryForEvent } from "@/lib/db/results";
import EventStatusBadge from "@/components/events/event-status-badge";
import RoundResultsTabs from "@/components/results/round-results-tabs";

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Results — {event.name}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Rankings by total average score across all judges and criteria.
          </p>
        </div>
      </div>

      {/* Tabbed rounds */}
      <RoundResultsTabs eventId={event.id} rounds={roundSummaries} />

      {/* Back link */}
      <Link
        href={`/dashboard/events/${event.id}`}
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to event
      </Link>
    </div>
  );
}
