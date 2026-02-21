export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import {
  getAssignmentsForRound,
  getJudgesForOrg,
} from "@/lib/db/judge-assignments";
import EventStatusBadge from "@/components/events/event-status-badge";
import AdvanceStatusButton from "@/components/events/advance-status-button";
import AddRoundDialog from "@/components/events/add-round-dialog";
import AssignJudgeDialog from "@/components/events/assign-judge-dialog";
import DeleteEventButton from "@/components/events/delete-event-button";
import { Badge } from "@/components/ui/badge";
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
  const judges = await getJudgesForOrg(session.user.organizationId);
  const assignmentEntries = await Promise.all(
    event.rounds.map(async (round) => {
      const assignments = await getAssignmentsForRound(round.id);
      return [round.id, assignments] as const;
    })
  );
  const assignmentsByRound = Object.fromEntries(assignmentEntries);

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
          <Link
            href={`/dashboard/events/${event.id}/edit`}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Edit Event
          </Link>
          <Link
            href={`/dashboard/events/${event.id}/results`}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
          >
            Results
          </Link>
          <AdvanceStatusButton
            eventId={event.id}
            currentStatus={event.status}
          />
          <AddRoundDialog eventId={event.id} />
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
                <TableHead>Judges</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {event.rounds.map((round) => {
                const assignments = assignmentsByRound[round.id] ?? [];

                return (
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
                    <TableCell>
                      {assignments.length === 0 ? (
                        <span className="text-sm text-muted-foreground">None</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assignments.map((assignment) => (
                            <Badge key={assignment.id} variant="secondary">
                              {assignment.judge.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <AssignJudgeDialog
                        eventId={event.id}
                        roundId={round.id}
                        roundType={round.type}
                        judges={judges}
                        assignedJudges={assignments}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Back link */}
      <DeleteEventButton eventId={event.id} />

      <Link
        href="/dashboard/events"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← Back to events
      </Link>
    </div>
  );
}
