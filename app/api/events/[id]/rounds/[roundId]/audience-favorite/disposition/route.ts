export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { AudienceFavoriteDispositionStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { setAudienceFavoriteDisposition } from "@/lib/db/governance";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  applicationId: z.string().min(1),
  status: z.nativeEnum(AudienceFavoriteDispositionStatus),
  note: z.string().trim().min(1, "A chair note is required."),
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

  const application = await prisma.application.findFirst({
    where: {
      id: parsed.data.applicationId,
      eventId: event.id,
      organizationId: session.user.organizationId,
    },
    select: { id: true },
  });

  if (!application) {
    return Response.json({ error: "Application not found in this event." }, { status: 404 });
  }

  const result = await setAudienceFavoriteDisposition({
    organizationId: session.user.organizationId,
    eventId: event.id,
    roundId: round.id,
    applicationId: application.id,
    actorUserId: session.user.id,
    status: parsed.data.status,
    note: parsed.data.note,
  });

  if (result.reason === "ROUND_CERTIFIED") {
    return Response.json(
      { error: "This round is certified and Audience Favorite controls are locked." },
      { status: 409 }
    );
  }

  return Response.json({ success: true, disposition: result.disposition });
}
