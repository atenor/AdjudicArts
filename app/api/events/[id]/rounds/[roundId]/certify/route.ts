export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import { certifyRound } from "@/lib/db/governance";

export async function POST(
  _request: Request,
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

  const result = await certifyRound({
    organizationId: session.user.organizationId,
    eventId: event.id,
    roundId: round.id,
    actorUserId: session.user.id,
  });

  if (result.reason === "NOT_FOUND") {
    return Response.json({ error: "Round not found" }, { status: 404 });
  }

  if (result.reason === "ALREADY_CERTIFIED") {
    return Response.json(
      { error: "This round is already certified.", certification: result.certification },
      { status: 409 }
    );
  }

  if (result.reason === "INCOMPLETE_FINALIZATIONS") {
    return Response.json(
      {
        error: "Every assigned judge must complete every applicant scorecard before certification.",
        readiness: result.readiness,
      },
      { status: 409 }
    );
  }

  return Response.json({ success: true, certification: result.certification });
}
