import { getPublicEventForApply } from "@/lib/db/applications";
import { EventStatus } from "@prisma/client";
import ApplyForm from "@/components/applications/apply-form";

export default async function ApplyPage({
  params,
}: {
  params: { eventId: string };
}) {
  const event = await getPublicEventForApply(params.eventId);

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-muted-foreground">Event not found.</p>
      </div>
    );
  }

  if (event.status !== EventStatus.OPEN) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-semibold">{event.name}</h1>
          <p className="text-muted-foreground">Applications are currently closed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/40 p-6 pt-12">
      <div className="w-full max-w-xl space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          {event.description && (
            <p className="text-muted-foreground mt-1">{event.description}</p>
          )}
        </div>
        <ApplyForm eventId={event.id} />
      </div>
    </div>
  );
}
