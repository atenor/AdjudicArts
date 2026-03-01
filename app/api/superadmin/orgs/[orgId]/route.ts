import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSuperAdmin } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  plan: z.enum(["starter", "regional", "national"]).optional(),
  status: z.enum(["trial", "active", "suspended"]).optional(),
  name: z.string().min(2).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { orgId: string } }
) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const [org, users, pendingInvites, events, tickets] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.orgId } }),
    prisma.user.findMany({
      where: { organizationId: params.orgId },
      select: { id: true, name: true, email: true, role: true, chapter: true, createdAt: true },
      orderBy: { role: "asc" },
    }),
    prisma.inviteToken.findMany({
      where: { organizationId: params.orgId, acceptedAt: null, expiresAt: { gt: now } },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { organizationId: params.orgId },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.supportTicket.findMany({
      where: { organizationId: params.orgId },
      select: { id: true, subject: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  return NextResponse.json({ org, users, pendingInvites, events, tickets });
}

export async function PATCH(
  req: Request,
  { params }: { params: { orgId: string } }
) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const updated = await prisma.organization.update({
    where: { id: params.orgId },
    data: parsed.data,
  });

  return NextResponse.json({ org: updated });
}
