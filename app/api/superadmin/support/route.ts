import { NextResponse } from "next/server";
import { getServerSuperAdmin } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { id: true, name: true } },
      submittedBy: { select: { name: true, email: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tickets });
}
