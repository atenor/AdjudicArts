export const dynamic = 'force-dynamic';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { createRound } from "@/lib/db/rounds";
import { z } from "zod";
import { RoundType } from "@prisma/client";

const createRoundSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(RoundType),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
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

  const event = await getEventById(params.id, session.user.organizationId);
  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createRoundSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { name, type, startAt, endAt } = parsed.data;

  const round = await createRound({
    organizationId: session.user.organizationId,
    eventId: event.id,
    name,
    type,
    startAt: startAt ? new Date(startAt) : undefined,
    endAt: endAt ? new Date(endAt) : undefined,
  });

  return Response.json(round, { status: 201 });
}
