import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { createEvent } from "@/lib/db/events";
import { z } from "zod";

const createEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  openAt: z.string().datetime({ offset: true }).optional().nullable(),
  closeAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export async function POST(request: Request) {
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

  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { name, description, openAt, closeAt } = parsed.data;

  const event = await createEvent({
    organizationId: session.user.organizationId,
    name,
    description,
    openAt: openAt ? new Date(openAt) : undefined,
    closeAt: closeAt ? new Date(closeAt) : undefined,
  });

  return Response.json(event, { status: 201 });
}
