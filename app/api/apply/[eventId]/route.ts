export const dynamic = 'force-dynamic';

import { z } from "zod";
import {
  getPublicEventForApply,
  createPublicApplication,
  hasExistingApplication,
} from "@/lib/db/applications";
import { EventStatus } from "@prisma/client";

const applySchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  voicePart: z.enum(["soprano", "mezzo", "tenor", "baritone", "bass"] as const),
  repertoire: z.string().min(1, "Repertoire is required"),
  videoUrl1: z.string().url().optional().or(z.literal("")),
  videoUrl2: z.string().url().optional().or(z.literal("")),
  videoUrl3: z.string().url().optional().or(z.literal("")),
});

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  const event = await getPublicEventForApply(params.eventId);

  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status !== EventStatus.OPEN) {
    return Response.json(
      { error: "Applications are currently closed" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { name, email, voicePart, repertoire, videoUrl1, videoUrl2, videoUrl3 } =
    parsed.data;

  const alreadyApplied = await hasExistingApplication(event.id, email);
  if (alreadyApplied) {
    return Response.json(
      { error: "An application with this email already exists for this event" },
      { status: 409 }
    );
  }

  await createPublicApplication({
    eventId: event.id,
    organizationId: event.organizationId,
    name,
    email,
    voicePart,
    repertoire,
    videoUrls: [videoUrl1, videoUrl2, videoUrl3].filter(
      (url): url is string => Boolean(url && url.length > 0)
    ),
  });

  return Response.json({ success: true }, { status: 201 });
}
