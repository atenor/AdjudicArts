export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import {
  deleteApplicationById,
  getApplicationById,
  updateApplicationProfile,
} from "@/lib/db/applications";

const patchSchema = z.object({
  chapter: z.string().trim().min(1).optional(),
  adminNote: z.string().trim().optional(),
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

  const application = await getApplicationById(
    params.id,
    session.user.organizationId
  );
  if (!application) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(application);
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

  const deleted = await deleteApplicationById(params.id, session.user.organizationId);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(deleted);
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateApplicationProfile({
    id: params.id,
    organizationId: session.user.organizationId,
    chapter: parsed.data.chapter,
    adminNote: parsed.data.adminNote,
    actor: session.user.email ?? session.user.name ?? "admin",
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(updated);
}
