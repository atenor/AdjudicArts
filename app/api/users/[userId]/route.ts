import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required").max(120, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  role: z.nativeEnum(Role).optional(),
  chapter: z.string().trim().max(120, "Chapter is too long").nullable().optional(),
});

async function getScopedUser(
  sessionUser: {
    id: string;
    role: Role;
    organizationId: string;
    chapter?: string | null;
  },
  userId: string
) {
  if (sessionUser.role === Role.ADMIN || sessionUser.role === Role.NATIONAL_CHAIR) {
    return prisma.user.findFirst({
      where: { id: userId, organizationId: sessionUser.organizationId },
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
    });
  }

  return null;
}

export async function PATCH(
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

    const parsed = updateUserSchema.safeParse(await req.json());
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

    const isSelf = target.id === session.user.id;
    const nextRole = parsed.data.role ?? target.role;
    const nextChapterRaw = parsed.data.chapter ?? target.chapter ?? null;
    const nextChapter = nextChapterRaw?.trim() ? nextChapterRaw.trim() : null;

    if (role === Role.CHAPTER_CHAIR) {
      const chairChapter = session.user.chapter?.trim();
      if (!chairChapter) {
        return NextResponse.json(
          { error: "Chapter chair account is missing chapter assignment" },
          { status: 400 }
        );
      }
      if (nextRole !== Role.CHAPTER_JUDGE) {
        return NextResponse.json(
          { error: "Chapter chairs can only manage chapter judges" },
          { status: 403 }
        );
      }
      if (nextChapter !== chairChapter) {
        return NextResponse.json(
          { error: "Chapter must remain your assigned chapter" },
          { status: 403 }
        );
      }
    }

    if (isSelf && parsed.data.role && parsed.data.role !== target.role) {
      return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
    }

    const existingEmailUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existingEmailUser && existingEmailUser.id !== target.id) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        role: nextRole,
        chapter: nextChapter,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chapter: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/users/[userId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
