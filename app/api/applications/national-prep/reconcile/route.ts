export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import {
  applyNationalPrepReconciliation,
  buildNationalPrepPreview,
} from "@/lib/national-prep-reconciliation";

const bodySchema = z.object({
  mode: z.enum(["preview", "apply"]),
  rosterText: z.string(),
  selectedApplicationIds: z.array(z.string().min(1)).optional(),
  applyChapterCorrections: z.boolean().optional(),
  applyNationalAdvancement: z.boolean().optional(),
});

export async function POST(request: Request) {
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
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (!parsed.data.rosterText.trim()) {
    return Response.json({ error: "Roster text is required." }, { status: 422 });
  }

  if (parsed.data.mode === "preview") {
    const result = await buildNationalPrepPreview({
      organizationId: session.user.organizationId,
      rosterText: parsed.data.rosterText,
    });
    return Response.json(result);
  }

  const result = await applyNationalPrepReconciliation({
    organizationId: session.user.organizationId,
    rosterText: parsed.data.rosterText,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    actorChapter: session.user.chapter,
    actorLabel: session.user.email ?? session.user.name ?? "admin",
    selectedApplicationIds: parsed.data.selectedApplicationIds,
    applyChapterCorrections: parsed.data.applyChapterCorrections,
    applyNationalAdvancement: parsed.data.applyNationalAdvancement,
  });

  return Response.json(result);
}
