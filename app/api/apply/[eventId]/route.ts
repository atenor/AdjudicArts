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

  const { name, email, voicePart, repertoire } = parsed.data;

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
  });

  return Response.json({ success: true }, { status: 201 });
}
