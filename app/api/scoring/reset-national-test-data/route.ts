export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { resetNationalJudgingTestData } from "@/lib/db/national-judging-reset";

const requestSchema = z.object({
  confirmationText: z.string().trim(),
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
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  if (parsed.data.confirmationText !== "RESET NATIONAL TEST DATA") {
    return Response.json(
      { error: "Type RESET NATIONAL TEST DATA exactly to confirm this reset." },
      { status: 422 }
    );
  }

  const result = await resetNationalJudgingTestData(session.user.organizationId);

  return Response.json({ success: true, result });
}
