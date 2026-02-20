import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { advanceEventStatus } from "@/lib/db/events";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
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

  const event = await advanceEventStatus(params.id, session.user.organizationId);
  if (!event) {
    return Response.json(
      { error: "Event not found or already at final status" },
      { status: 400 }
    );
  }

  return Response.json(event);
}
