import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSuperAdmin } from "@/lib/superadmin-auth";
import { prisma } from "@/lib/prisma";
import { sendTicketReply } from "@/lib/email";

const replySchema = z.object({ body: z.string().min(1) });
const patchSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: { ticketId: string } }
) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      organization: { select: { name: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ticket });
}

export async function PATCH(
  req: Request,
  { params }: { params: { ticketId: string } }
) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: params.ticketId },
    data: parsed.data,
  });

  return NextResponse.json({ ticket });
}

export async function POST(
  req: Request,
  { params }: { params: { ticketId: string } }
) {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Reply body required" }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: { submittedBy: { select: { email: true, name: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const message = await prisma.supportMessage.create({
    data: {
      ticketId: ticket.id,
      body: parsed.data.body,
      fromSA: true,
      authorId: sa.id,
    },
  });

  // Notify org user by email
  const ticketUrl = `${process.env.NEXTAUTH_URL}/dashboard/support`;
  sendTicketReply(
    ticket.submittedBy.email,
    ticket.submittedBy.name,
    parsed.data.body,
    ticketUrl
  ).catch(console.error);

  return NextResponse.json({ message }, { status: 201 });
}
