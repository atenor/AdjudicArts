export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { reopenJudgeSubmission } from "@/lib/db/governance";

const requestSchema = z.object({
  roundId: z.string().min(1),
  judgeId: z.string().min(1),
  reason: z.string().trim().min(1, "A reopen reason is required."),
});

export async function POST(
  request: Request,
  { params }: { params: { applicationId: string } }
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await reopenJudgeSubmission({
    organizationId: session.user.organizationId,
    applicationId: params.applicationId,
    judgeId: parsed.data.judgeId,
    roundId: parsed.data.roundId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    reason: parsed.data.reason,
  });

  if (result.reason === "NOT_FOUND") {
    return Response.json({ error: "Judge submission not found." }, { status: 404 });
  }

  if (result.reason === "NOT_FINALIZED") {
    return Response.json(
      { error: "Only finalized judge submissions can be reopened." },
      { status: 409 }
    );
  }

  if (result.reason === "ROUND_CERTIFIED") {
    return Response.json(
      { error: "This round has been certified and can no longer be reopened." },
      { status: 409 }
    );
  }

  return Response.json({ success: true, submission: result.submission });
}
