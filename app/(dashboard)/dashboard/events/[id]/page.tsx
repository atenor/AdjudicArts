import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import EventStatusBadge from "@/components/events/event-status-badge";
import AdvanceStatusButton from "@/components/events/advance-status-button";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) notFound();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{event.name}</h1>
            <EventStatusBadge status={event.status} />
          </div>
          {event.description && (
            <p className="text-muted-foreground">{event.description}</p>
          )}
          <p className="text-sm text-muted-foreground">
            {formatDate(event.openAt)} – {formatDate(event.closeAt)}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <AdvanceStatusButton
            eventId={event.id}
            currentStatus={event.status}
          />
          <Button variant="outline" disabled>
            Add Round
          </Button>
        </div>
      </div>

      {/* Rounds */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Rounds</h2>
        {event.rounds.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rounds yet. Use &ldquo;Add Round&rdquo; to create one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {event.rounds.map((round) => (
                <TableRow key={round.id}>
                  <TableCell className="font-medium">{round.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm capitalize">
                    {round.type.replace("_", " ").toLowerCase()}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(round.startAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(round.endAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Back link */}
      <Link
        href="/dashboard/events"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to events
      </Link>
    </div>
  );
}
