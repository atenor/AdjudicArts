export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { deleteEventById, getEventById, updateEventById } from "@/lib/db/events";
import { z } from "zod";

const updateEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  openAt: z.string().datetime({ offset: true }).optional().nullable(),
  closeAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN", "NATIONAL_CHAIR");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(event);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN", "NATIONAL_CHAIR");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateEventById(params.id, session.user.organizationId, {
    name: parsed.data.name,
    description: parsed.data.description,
    openAt: parsed.data.openAt ? new Date(parsed.data.openAt) : undefined,
    closeAt: parsed.data.closeAt ? new Date(parsed.data.closeAt) : undefined,
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN", "NATIONAL_CHAIR");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const deleted = await deleteEventById(params.id, session.user.organizationId);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!deleted.ok) {
    return Response.json(
      {
        error: "Cannot delete event with existing applications. Purge participants first.",
        code: deleted.reason,
        applicationCount: deleted.applicationCount,
      },
      { status: 409 }
    );
  }

  return Response.json({ ok: true });
}
