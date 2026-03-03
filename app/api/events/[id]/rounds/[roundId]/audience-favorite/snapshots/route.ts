export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { AudienceFavoriteSnapshotType } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { saveAudienceFavoriteSnapshot } from "@/lib/db/governance";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  snapshotType: z.nativeEnum(AudienceFavoriteSnapshotType),
  entries: z.array(
    z.object({
      applicationId: z.string().min(1),
      viewCount: z.number().int().nonnegative(),
    })
  ),
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

  const applicationIds = parsed.data.entries.map((entry) => entry.applicationId);
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
        { error: "Audience Favorite snapshots must target applications in this event." },
        { status: 422 }
      );
    }
  }

  const result = await saveAudienceFavoriteSnapshot({
    organizationId: session.user.organizationId,
    eventId: event.id,
    roundId: round.id,
    actorUserId: session.user.id,
    snapshotType: parsed.data.snapshotType,
    entries: parsed.data.entries,
  });

  if (result.reason === "ROUND_CERTIFIED") {
    return Response.json(
      { error: "This round is certified and Audience Favorite snapshots are locked." },
      { status: 409 }
    );
  }

  return Response.json({ success: true });
}
