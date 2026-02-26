export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { advanceApplicationStatusWithPermissions } from "@/lib/db/applications";
import { sendStatusUpdate } from "@/lib/email";

const bodySchema = z.object({
  status: z.nativeEnum(ApplicationStatus),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN", "NATIONAL_CHAIR", "CHAPTER_CHAIR");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await advanceApplicationStatusWithPermissions({
    id: params.id,
    nextStatus: parsed.data.status,
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    actorChapter: session.user.chapter,
    reason: parsed.data.reason,
  });

  if (result.reason === "FORBIDDEN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (result.reason === "NOT_FOUND") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const updated = result.updated;

  const statusUrl = `${process.env.NEXTAUTH_URL ?? ""}/status/${updated.id}`;
  try {
    await sendStatusUpdate(
      updated.applicant.email,
      updated.applicant.name,
      updated.event.name,
      updated.status,
      statusUrl
    );
  } catch {
    // Email failure must never break the main flow
  }

  return Response.json(updated);
}
