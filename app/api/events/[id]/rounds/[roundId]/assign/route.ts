export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getEventById } from "@/lib/db/events";
import {
  assignJudgeToRound,
  getAssignmentsForRound,
  removeJudgeFromRound,
} from "@/lib/db/judge-assignments";

const assignSchema = z.object({
  judgeId: z.string().min(1),
});

async function ensureAuthorized(eventId: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    requireRole(session, "ADMIN", "NATIONAL_CHAIR");
  } catch {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const event = await getEventById(eventId, session.user.organizationId);
  if (!event) {
    return { error: Response.json({ error: "Event not found" }, { status: 404 }) };
  }

  return { session, event };
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; roundId: string } }
) {
  const auth = await ensureAuthorized(params.id);
  if ("error" in auth) return auth.error;
  const roundInEvent = auth.event.rounds.some((round) => round.id === params.roundId);
  if (!roundInEvent) {
    return Response.json({ error: "Round not found for event" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await assignJudgeToRound(
    parsed.data.judgeId,
    params.roundId,
    auth.session.user.organizationId
  );

  if (!result.ok) {
    if (result.reason === "ROUND_NOT_FOUND") {
      return Response.json({ error: "Round not found" }, { status: 404 });
    }
    if (result.reason === "JUDGE_NOT_FOUND") {
      return Response.json({ error: "Judge not found" }, { status: 404 });
    }
    return Response.json(
      { error: "Judge role does not match round type" },
      { status: 400 }
    );
  }

  const assignments = await getAssignmentsForRound(params.roundId);
  return Response.json(assignments);
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; roundId: string } }
) {
  const auth = await ensureAuthorized(params.id);
  if ("error" in auth) return auth.error;
  const roundInEvent = auth.event.rounds.some((round) => round.id === params.roundId);
  if (!roundInEvent) {
    return Response.json({ error: "Round not found for event" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const assignments = await removeJudgeFromRound(
    parsed.data.judgeId,
    params.roundId
  );

  return Response.json(assignments);
}
