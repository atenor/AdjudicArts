export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/auth-guards";
import { getImportableEvents } from "@/lib/db/import";
import ImportApplicationsForm from "@/components/applications/import-applications-form";

export const metadata: Metadata = { title: "Import Applications" };

export default async function ImportApplicationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasRole(session, "ADMIN")) redirect("/dashboard");

  const events = await getImportableEvents(session.user.organizationId);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Import Applications</h1>
        <p className="text-sm text-muted-foreground">
          Import real applicant records from CSV into the selected event.
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No events available. Create an event before importing applicants.
        </p>
      ) : (
        <ImportApplicationsForm
          events={events.map((event) => ({
            ...event,
            openAt: event.openAt,
            closeAt: event.closeAt,
          }))}
        />
      )}
    </div>
  );
}
