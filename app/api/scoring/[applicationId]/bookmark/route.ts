export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { getScoringApplicationForJudge, setJudgeBookmark } from "@/lib/db/scores";

async function ensureJudgeAccess(applicationId: string) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    requireRole(session, "CHAPTER_JUDGE", "NATIONAL_JUDGE");
  } catch {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const scoringContext = await getScoringApplicationForJudge(
    applicationId,
    session.user.id,
    session.user.organizationId,
    session.user.role,
    session.user.chapter
  );

  if (!scoringContext) {
    return {
      error: Response.json(
        { error: "Application is not available for scoring" },
        { status: 404 }
      ),
    };
  }

  return { session };
}

export async function POST(
  _request: Request,
  { params }: { params: { applicationId: string } }
) {
  const auth = await ensureJudgeAccess(params.applicationId);
  if ("error" in auth) return auth.error;

  await setJudgeBookmark({
    organizationId: auth.session.user.organizationId,
    judgeId: auth.session.user.id,
    applicationId: params.applicationId,
    active: true,
  });

  return Response.json({ success: true, active: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { applicationId: string } }
) {
  const auth = await ensureJudgeAccess(params.applicationId);
  if ("error" in auth) return auth.error;

  await setJudgeBookmark({
    organizationId: auth.session.user.organizationId,
    judgeId: auth.session.user.id,
    applicationId: params.applicationId,
    active: false,
  });

  return Response.json({ success: true, active: false });
}
