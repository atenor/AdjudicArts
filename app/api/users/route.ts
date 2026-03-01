import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    requireRole(session, Role.ADMIN);

    const { organizationId } = session.user;
    const now = new Date();

    const [users, pendingInvites] = await Promise.all([
      prisma.user.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          chapter: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.inviteToken.findMany({
        where: {
          organizationId,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          expiresAt: true,
          createdAt: true,
          invitedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ users, pendingInvites });
  } catch (err) {
    console.error("Users GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    requireRole(session, Role.ADMIN);

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const inviteId = searchParams.get("inviteId");

    if (userId) {
      // Cannot delete yourself
      if (userId === session.user.id) {
        return NextResponse.json({ error: "You cannot remove yourself" }, { status: 400 });
      }
      // Verify user belongs to org
      const user = await prisma.user.findFirst({
        where: { id: userId, organizationId: session.user.organizationId },
      });
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      await prisma.user.delete({ where: { id: userId } });
    } else if (inviteId) {
      const invite = await prisma.inviteToken.findFirst({
        where: { id: inviteId, organizationId: session.user.organizationId },
      });
      if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
      await prisma.inviteToken.delete({ where: { id: inviteId } });
    } else {
      return NextResponse.json({ error: "userId or inviteId required" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Users DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
