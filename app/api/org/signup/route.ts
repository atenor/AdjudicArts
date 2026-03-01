import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { sendWelcomeEmail } from "@/lib/email";

const signupSchema = z.object({
  orgName: z.string().min(2, "Organization name must be at least 2 characters"),
  adminName: z.string().min(2, "Your name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { orgName, adminName, email, password } = parsed.data;

    // Check for duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create org + admin in a single transaction
    const { org } = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: orgName, plan: "starter", status: "trial" },
      });
      await tx.user.create({
        data: {
          organizationId: org.id,
          email,
          name: adminName,
          role: Role.ADMIN,
          passwordHash,
        },
      });
      return { org };
    });

    // Fire welcome email (non-blocking)
    sendWelcomeEmail(email, adminName, orgName).catch(console.error);

    return NextResponse.json({ orgId: org.id }, { status: 201 });
  } catch (err) {
    console.error("Org signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
