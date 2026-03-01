import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const replySchema = z.object({
  body: z.string().min(1, "Reply cannot be empty"),
});

export async function GET(
  _req: Request,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.ticketId, organizationId: session.user.organizationId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    return NextResponse.json({ ticket });
  } catch (err) {
    console.error("Ticket GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: { ticketId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.ticketId, organizationId: session.user.organizationId },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const body = await req.json();
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        body: parsed.data.body,
        fromSA: false,
        authorId: session.user.id,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("Ticket reply error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
