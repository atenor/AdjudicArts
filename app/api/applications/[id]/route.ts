export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import {
  deleteApplicationById,
  forwardApplicationToNationalsWithBypass,
  getApplicationById,
  updateApplicationProfile,
} from "@/lib/db/applications";

const patchSchema = z.object({
  applicantName: z.string().trim().min(1).optional(),
  chapter: z.string().trim().min(1).optional(),
  adminNote: z.string().trim().optional(),
  video1Title: z.string().trim().optional(),
  video1Url: z.string().trim().optional(),
  video2Title: z.string().trim().optional(),
  video2Url: z.string().trim().optional(),
  video3Title: z.string().trim().optional(),
  video3Url: z.string().trim().optional(),
});

const actionSchema = z.object({
  action: z.literal("FORWARD_TO_NATIONALS_BYPASS_CHAPTER"),
  reason: z.string().trim().max(500).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    requireRole(
      session,
      "ADMIN",
      "NATIONAL_CHAIR",
      "CHAPTER_CHAIR",
      "CHAPTER_JUDGE",
      "NATIONAL_JUDGE"
    );
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const application = await getApplicationById(
    params.id,
    session.user.organizationId,
    {
      role: session.user.role,
      userChapter: session.user.chapter,
    }
  );
  if (!application) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(application);
}

export async function DELETE(
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

  const deleted = await deleteApplicationById(params.id, session.user.organizationId);
  if (!deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(deleted);
}

export async function PATCH(
  request: Request,
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const updated = await updateApplicationProfile({
    id: params.id,
    organizationId: session.user.organizationId,
    applicantName: parsed.data.applicantName,
    chapter: parsed.data.chapter,
    adminNote: parsed.data.adminNote,
    video1Title: parsed.data.video1Title,
    video1Url: parsed.data.video1Url,
    video2Title: parsed.data.video2Title,
    video2Url: parsed.data.video2Url,
    video3Title: parsed.data.video3Title,
    video3Url: parsed.data.video3Url,
    actor: session.user.email ?? session.user.name ?? "admin",
  });

  if (!updated) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json(updated);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
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

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await forwardApplicationToNationalsWithBypass({
    id: params.id,
    organizationId: session.user.organizationId,
    actorUserId: session.user.id,
    actorRole: session.user.role,
    actorChapter: session.user.chapter,
    reason: parsed.data.reason,
  });

  if (result.reason === "NOT_FOUND") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (result.reason === "FORBIDDEN") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(result.updated);
}
