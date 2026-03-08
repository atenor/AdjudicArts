import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Profile name is required").max(120, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(Role),
  chapter: z.string().trim().max(120, "Chapter is too long").nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actorRole = session.user.role;
    if (
      actorRole !== Role.ADMIN &&
      actorRole !== Role.NATIONAL_CHAIR &&
      actorRole !== Role.CHAPTER_CHAIR
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const chapterRaw = parsed.data.chapter ?? null;
    const chapter = chapterRaw?.trim() ? chapterRaw.trim() : null;
    const role = parsed.data.role;

    if (actorRole === Role.CHAPTER_CHAIR) {
      const chairChapter = session.user.chapter?.trim();
      if (!chairChapter) {
        return NextResponse.json(
          { error: "Chapter chair account is missing chapter assignment" },
          { status: 400 }
        );
      }
      if (role !== Role.CHAPTER_JUDGE) {
        return NextResponse.json(
          { error: "Chapter chairs can only create chapter judges" },
          { status: 403 }
        );
      }
      if (chapter && chapter !== chairChapter) {
        return NextResponse.json(
          { error: "Chapter must match your assigned chapter" },
          { status: 403 }
        );
      }
    }

    if (role === Role.CHAPTER_JUDGE && !(chapter || session.user.chapter?.trim())) {
      return NextResponse.json(
        { error: "Chapter is required for chapter judge accounts" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true },
    });
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const resolvedChapter =
      actorRole === Role.CHAPTER_CHAIR ? session.user.chapter?.trim() ?? null : chapter;

    const user = await prisma.user.create({
      data: {
        organizationId: session.user.organizationId,
        name: parsed.data.name,
        email: parsed.data.email,
        role,
        chapter: resolvedChapter,
        passwordHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chapter: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("POST /api/users/manual-create error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
