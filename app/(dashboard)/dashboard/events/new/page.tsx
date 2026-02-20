import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import EventForm from "@/components/events/event-form";

export default async function NewEventPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN", "NATIONAL_CHAIR")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Create Event</h1>
      <EventForm />
    </div>
  );
}
