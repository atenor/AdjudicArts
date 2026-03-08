import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

async function getScopedUser(
  sessionUser: {
    role: Role;
    organizationId: string;
    chapter?: string | null;
  },
  userId: string
) {
  if (sessionUser.role === Role.ADMIN || sessionUser.role === Role.NATIONAL_CHAIR) {
    return prisma.user.findFirst({
      where: { id: userId, organizationId: sessionUser.organizationId },
      select: { id: true, role: true, chapter: true },
    });
  }

  if (sessionUser.role === Role.CHAPTER_CHAIR) {
    const chapter = sessionUser.chapter?.trim();
    if (!chapter) return null;
    return prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: sessionUser.organizationId,
        role: Role.CHAPTER_JUDGE,
        chapter,
      },
      select: { id: true, role: true, chapter: true },
    });
  }

  return null;
}

export async function POST(
  req: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = session.user.role;
    if (role !== Role.ADMIN && role !== Role.NATIONAL_CHAIR && role !== Role.CHAPTER_CHAIR) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = resetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const target = await getScopedUser(session.user, params.userId);
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/users/[userId]/reset-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
