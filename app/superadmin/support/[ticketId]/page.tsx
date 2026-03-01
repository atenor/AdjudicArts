import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SATicketClient from "./ticket-client";

export default async function SATicketPage({ params }: { params: { ticketId: string } }) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.ticketId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      organization: { select: { id: true, name: true } },
      submittedBy: { select: { name: true, email: true } },
    },
  });

  if (!ticket) notFound();

  return (
    <div>
      <div style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "#a89dcc" }}>
        <Link href="/superadmin/support" style={{ color: "#c9a84c", textDecoration: "none" }}>Support</Link>
        <span>/</span>
        <span>{ticket.subject}</span>
      </div>
      <SATicketClient ticket={ticket} />
    </div>
  );
}
