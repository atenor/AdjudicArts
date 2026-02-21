export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import EventForm from "@/components/events/event-form";

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
    <div className="space-y-6">
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
    </div>
  );
}
