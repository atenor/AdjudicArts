import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createSAToken,
  setSASessionCookie,
  clearSASessionCookie,
  getServerSuperAdmin,
} from "@/lib/superadmin-auth";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const sa = await prisma.superAdmin.findUnique({ where: { email } });
    if (!sa) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, sa.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = createSAToken(sa.id, sa.email, sa.name);
    setSASessionCookie(token);

    return NextResponse.json({ name: sa.name });
  } catch (err) {
    console.error("SA login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  clearSASessionCookie();
  return NextResponse.json({ ok: true });
}

// Verify session (used by SA pages)
export async function GET() {
  const sa = await getServerSuperAdmin();
  if (!sa) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ id: sa.id, email: sa.email, name: sa.name });
}
