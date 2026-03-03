export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import EventForm from "@/components/events/event-form";
import TimelineEditor from "@/components/events/timeline-editor";

export default async function EditEventPage({
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
      <h1 className="text-2xl font-semibold">Edit Event</h1>
      <EventForm
        mode="edit"
        eventId={event.id}
        initialValues={{
          name: event.name,
          description: event.description,
          openAt: event.openAt,
          closeAt: event.closeAt,
        }}
      />
      <div className="space-y-3 pt-2 border-t">
        <div>
          <h2 className="text-lg font-medium">Timeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key dates and milestones for this event. Visible to admins on the event detail page.
          </p>
        </div>
        <TimelineEditor event={{ id: event.id, timeline: event.timeline ?? null }} />
      </div>
    </div>
  );
}
