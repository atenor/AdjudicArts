import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSupportNotification } from "@/lib/email";

const createSchema = z.object({
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  body: z.string().min(10, "Please provide more detail"),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        organizationId: session.user.organizationId,
        submittedById: session.user.id,
        subject: parsed.data.subject,
        body: parsed.data.body,
      },
    });

    const ticketUrl = `${process.env.NEXTAUTH_URL}/superadmin/support/${ticket.id}`;
    sendSupportNotification(
      "support@adjudicarts.dev",
      session.user.organizationId,
      parsed.data.subject,
      parsed.data.body,
      ticketUrl
    ).catch(console.error);

    return NextResponse.json({ id: ticket.id }, { status: 201 });
  } catch (err) {
    console.error("Create ticket error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tickets = await prisma.supportTicket.findMany({
      where: { organizationId: session.user.organizationId },
      select: {
        id: true,
        subject: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("Tickets GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
