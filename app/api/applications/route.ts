export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { ApplicationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { listApplicationsByOrg } from "@/lib/db/applications";

const querySchema = z.object({
  status: z.nativeEnum(ApplicationStatus).optional(),
});

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const applications = await listApplicationsByOrg(
    session.user.organizationId,
    parsed.data.status,
    {
      role: session.user.role,
      userChapter: session.user.chapter,
    }
  );

  return Response.json(applications);
}
