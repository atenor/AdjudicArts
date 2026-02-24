export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { deleteApplicationsByIds } from "@/lib/db/applications";

type BatchDeleteBody = {
  ids?: string[];
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(session, "ADMIN");
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: BatchDeleteBody;
  try {
    body = (await request.json()) as BatchDeleteBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawIds = Array.isArray(body.ids) ? body.ids : [];
  const ids = rawIds.filter((id): id is string => typeof id === "string" && id.length > 0);

  if (ids.length === 0) {
    return Response.json({ error: "No application ids provided" }, { status: 400 });
  }

  const result = await deleteApplicationsByIds(ids, session.user.organizationId);
  return Response.json(result);
}
