export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { listEventsByOrg } from "@/lib/db/events";
import EventStatusBadge from "@/components/events/event-status-badge";
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

export default async function EventsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  const events = await listEventsByOrg(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button asChild>
          <Link href="/dashboard/events/new">New Event</Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No events yet. Create your first event to get started.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opens</TableHead>
              <TableHead>Closes</TableHead>
              <TableHead>Rounds</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell>
                  <Link
                    href={`/dashboard/events/${event.id}`}
                    className="font-medium hover:underline"
                  >
                    {event.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <EventStatusBadge status={event.status} />
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(event.openAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDate(event.closeAt)}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {event._count.rounds}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
