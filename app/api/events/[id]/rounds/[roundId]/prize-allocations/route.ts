export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { replaceChairPrizeAllocations } from "@/lib/db/governance";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  allocations: z.array(
    z.object({
      applicationId: z.string().min(1),
      label: z.string().trim().min(1),
      amountCents: z.number().int().nonnegative().nullable().optional(),
    })
  ),
  internalNote: z.string().trim().nullable().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string; roundId: string } }
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
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  const round = event.rounds.find((candidate) => candidate.id === params.roundId);
  if (!round) {
    return Response.json({ error: "Round not found for event" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const applicationIds = parsed.data.allocations.map((allocation) => allocation.applicationId);
  if (applicationIds.length > 0) {
    const applicationCount = await prisma.application.count({
      where: {
        organizationId: session.user.organizationId,
        eventId: event.id,
        id: { in: applicationIds },
      },
    });

    if (applicationCount !== applicationIds.length) {
      return Response.json(
        { error: "All prize allocations must target applications in this event." },
        { status: 422 }
      );
    }
  }

  const result = await replaceChairPrizeAllocations({
    organizationId: session.user.organizationId,
    eventId: event.id,
    roundId: round.id,
    actorUserId: session.user.id,
    allocations: parsed.data.allocations,
    internalNote: parsed.data.internalNote ?? null,
  });

  if (result.reason === "ROUND_CERTIFIED") {
    return Response.json(
      { error: "This round is certified and prize allocations are locked." },
      { status: 409 }
    );
  }

  if (result.reason === "INTERNAL_NOTE_REQUIRED") {
    return Response.json(
      { error: "An internal note is required when modifying prize amounts or structure." },
      { status: 422 }
    );
  }

  return Response.json({ success: true });
}
