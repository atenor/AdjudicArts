import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { sendInviteEmail } from "@/lib/email";

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.nativeEnum(Role),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    requireRole(session, Role.ADMIN, Role.NATIONAL_CHAIR, Role.CHAPTER_CHAIR);

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { email, role, name } = parsed.data;
    const { organizationId } = session.user;

    if (session.user.role === Role.CHAPTER_CHAIR) {
      if (role !== Role.CHAPTER_JUDGE) {
        return NextResponse.json(
          { error: "Chapter chairs can only invite chapter judges" },
          { status: 403 }
        );
      }
      if (!session.user.chapter?.trim()) {
        return NextResponse.json(
          { error: "Chapter chair account is missing chapter assignment" },
          { status: 400 }
        );
      }
    }

    // Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    // Check for active pending invite
    const now = new Date();
    const existingInvite = await prisma.inviteToken.findFirst({
      where: {
        email,
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (existingInvite) {
      return NextResponse.json(
        { error: "A pending invite already exists for this email" },
        { status: 409 }
      );
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invite = await prisma.inviteToken.create({
      data: {
        organizationId,
        email,
        role,
        name: name ?? null,
        tokenHash,
        invitedById: session.user.id,
        expiresAt,
      },
    });

    const inviteUrl = `${process.env.NEXTAUTH_URL}/accept-invite/${rawToken}`;
    const roleLabel = ROLE_LABELS[role] ?? role;

    let emailSent = false;
    let deliveryId: string | null = null;
    if (process.env.RESEND_API_KEY) {
      try {
        deliveryId = await sendInviteEmail(
          email,
          inviteUrl,
          roleLabel,
          session.user.name ?? "An administrator"
        );
        emailSent = Boolean(deliveryId);
        console.info("Invite email queued", {
          inviteId: invite.id,
          to: email,
          role,
          deliveryId,
        });
      } catch (mailError) {
        console.error("Invite email send failed", {
          inviteId: invite.id,
          to: email,
          role,
          error: mailError instanceof Error ? mailError.message : String(mailError),
        });
      }
    }

    return NextResponse.json(
      {
        id: invite.id,
        inviteUrl,
        emailSent,
        deliveryId,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
