import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SupportClient from "./support-client";

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

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

  return <SupportClient initialTickets={tickets} />;
}
