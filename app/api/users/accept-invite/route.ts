import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = acceptSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const { token, name, password } = parsed.data;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const invite = await prisma.inviteToken.findUnique({ where: { tokenHash } });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }
    if (invite.acceptedAt) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite link has expired" }, { status: 410 });
    }

    // Race condition guard
    const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          organizationId: invite.organizationId,
          email: invite.email,
          name,
          role: invite.role,
          passwordHash,
        },
      }),
      prisma.inviteToken.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ role: user.role }, { status: 200 });
  } catch (err) {
    console.error("Accept invite error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
