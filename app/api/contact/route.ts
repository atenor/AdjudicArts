import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactInquiry } from "@/lib/email";

const contactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  organization: z.string().optional(),
  message: z.string().min(10, "Please provide more detail"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, organization, message } = parsed.data;

    // TODO: replace Resend email with CRM/helpdesk webhook when ready
    await sendContactInquiry(
      "support@adjudicarts.dev",
      name,
      email,
      organization,
      message
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
