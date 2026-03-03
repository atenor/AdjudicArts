export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { closeOutChapterAdjudication } from "@/lib/db/applications";
import { getEventById } from "@/lib/db/events";
import { sendStatusUpdate } from "@/lib/email";

const bodySchema = z.object({
  chapter: z.string().trim().min(1).optional(),
  winnerApplicationIds: z.array(z.string().trim().min(1)).min(1),
  alternateApplicationId: z.string().trim().min(1).nullable().optional(),
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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await closeOutChapterAdjudication({
    organizationId: session.user.organizationId,
    eventId: event.id,
    roundId: params.roundId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    actorChapter: session.user.chapter,
    chapter: parsed.data.chapter ?? null,
    winnerApplicationIds: parsed.data.winnerApplicationIds,
    alternateApplicationId: parsed.data.alternateApplicationId ?? null,
  });

  if (result.reason === "FORBIDDEN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (result.reason === "NOT_FOUND") {
    return Response.json({ error: "Round not found" }, { status: 404 });
  }
  if (result.reason === "NOT_CHAPTER_ROUND") {
    return Response.json({ error: "This action only applies to chapter rounds." }, { status: 409 });
  }
  if (result.reason === "ROUND_CERTIFIED") {
    return Response.json({ error: "This round is already certified and locked." }, { status: 409 });
  }
  if (result.reason === "ADVANCEMENT_SLOTS_NOT_CONFIGURED") {
    return Response.json(
      { error: "Set how many applicants advance from this round before closing out the chapter." },
      { status: 409 }
    );
  }
  if (result.reason === "CHAPTER_REQUIRED") {
    return Response.json({ error: "A chapter is required for chapter closeout." }, { status: 409 });
  }
  if (result.reason === "INVALID_WINNER_COUNT") {
    return Response.json({ error: "Select exactly the configured number of advancing applicants." }, { status: 409 });
  }
  if (result.reason === "INVALID_SELECTION") {
    return Response.json({ error: "Selected winners/alternate do not match this chapter." }, { status: 409 });
  }
  if (result.reason === "UNRESOLVED_APPLICATIONS") {
    return Response.json(
      { error: "Resolve pending approval or correction-required applicants before closing out this chapter." },
      { status: 409 }
    );
  }
  if (result.reason === "INCOMPLETE_RESULTS") {
    return Response.json(
      { error: "Chapter closeout requires complete ranked results for every chapter adjudication applicant." },
      { status: 409 }
    );
  }

  if (result.reason !== "OK") {
    return Response.json({ error: "Unable to close out this chapter." }, { status: 409 });
  }

  for (const application of result.updatedApplications) {
    const statusUrl = `${process.env.NEXTAUTH_URL ?? ""}/status/${application.id}`;
    try {
      await sendStatusUpdate(
        application.applicant.email,
        application.applicant.name,
        application.event.name,
        application.status,
        statusUrl
      );
    } catch {
      // Email failure must never break the main flow.
    }
  }

  return Response.json({
    success: true,
    chapter: result.chapter,
    winners: result.winners,
    alternate: result.alternate,
  });
}
