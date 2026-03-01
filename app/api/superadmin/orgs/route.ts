import { NextResponse } from "next/server";
import { getServerSuperAdmin } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      plan: true,
      status: true,
      createdAt: true,
      _count: {
        select: { users: true, events: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ orgs });
}
