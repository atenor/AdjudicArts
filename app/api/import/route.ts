export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import {
  getImportableEvents,
  importApplicantsFromRows,
  parseApplicantCsv,
  purgeEventApplications,
} from "@/lib/db/import";

const bodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("preview"),
    csvData: z.string().min(1, "CSV data is required"),
    eventId: z.string().min(1, "Event is required"),
  }),
  z.object({
    mode: z.literal("import"),
    csvData: z.string().min(1, "CSV data is required"),
    eventId: z.string().min(1, "Event is required"),
  }),
  z.object({
    mode: z.literal("purge"),
    eventId: z.string().min(1, "Event is required"),
  }),
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = bodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return Response.json({ error: parsedBody.error.flatten() }, { status: 422 });
  }

  const { eventId, mode } = parsedBody.data;

  const events = await getImportableEvents(session.user.organizationId);
  const targetEvent = events.find((event) => event.id === eventId);
  if (!targetEvent) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (mode === "purge") {
    const result = await purgeEventApplications(
      eventId,
      session.user.organizationId
    );
    return Response.json(result);
  }

  const rows = parseApplicantCsv(parsedBody.data.csvData);
  if (rows.length === 0) {
    return Response.json({ error: "CSV has no data rows" }, { status: 422 });
  }

  if (mode === "preview") {
    return Response.json({
      totalRows: rows.length,
      preview: rows,
    });
  }

  const result = await importApplicantsFromRows({
    rows,
    eventId,
    organizationId: session.user.organizationId,
  });

  return Response.json(result);
}
