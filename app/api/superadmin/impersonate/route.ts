import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSuperAdmin, createImpersonationToken, setImpersonationCookie, clearImpersonationCookie } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";

const impersonateSchema = z.object({ targetUserId: z.string() });

export async function POST(req: Request) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = impersonateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "targetUserId required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.targetUserId },
    include: { organization: { select: { id: true, name: true } } },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const token = createImpersonationToken(
    sa.id,
    user.id,
    user.organization.id,
    user.organization.name
  );
  setImpersonationCookie(token);

  return NextResponse.json({ ok: true, orgName: user.organization.name });
}

export async function DELETE() {
  clearImpersonationCookie();
  return NextResponse.json({ ok: true });
}
