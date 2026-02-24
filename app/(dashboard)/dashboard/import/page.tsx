export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getImportableEvents } from "@/lib/db/import";
import ImportApplicationsForm from "@/components/applications/import-applications-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Import Applications" };

export default async function ImportApplicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN")) redirect("/dashboard");

  const events = await getImportableEvents(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Import Applications</h1>
          <p className="text-sm text-muted-foreground">
            Import real applicant records from CSV into the selected event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/events">Back to Events</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events available. Create an event before importing applicants.
        </p>
      ) : (
        <div className="space-y-3">
          <ImportApplicationsForm
            events={events.map((event) => ({
              ...event,
              openAt: event.openAt,
              closeAt: event.closeAt,
            }))}
          />
          <div className="text-sm">
            <Link href="/dashboard/events" className="text-muted-foreground hover:underline">
              ← Done importing? Return to events
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
