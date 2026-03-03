import { Resend } from "resend";
import { ApplicationStatus } from "@prisma/client";

// Lazy-initialize so the missing key in build/dev doesn't throw at module load time
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = "AdjudicArts <noreply@adjudicarts.dev>";

const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  PENDING_APPROVAL: "Your application has been received and is awaiting review.",
  CORRECTION_REQUIRED:
    "Your application needs a correction before it can be approved for adjudication.",
  APPROVED_FOR_CHAPTER_ADJUDICATION:
    "Your application has been approved for chapter adjudication.",
  PENDING_NATIONAL_ACCEPTANCE:
    "Your application has been selected as a chapter winner and is awaiting national approval.",
  APPROVED_FOR_NATIONAL_ADJUDICATION:
    "Your application has been accepted for national adjudication.",
  EXCLUDED:
    "Your application has been excluded from this cycle. If you believe this is in error, please contact the program and we will review it with you.",
  ALTERNATE:
    "Your application has been designated as an alternate and may still advance if space opens.",
  DID_NOT_ADVANCE:
    "Your application completed adjudication but was not selected to advance to the next round.",
  WITHDRAWN: "This application is no longer active in the current cycle.",
  SUBMITTED_PENDING_APPROVAL: "Your application has been received and is awaiting review.",
  CHAPTER_ADJUDICATION: "Your application has been approved for chapter adjudication.",
  NATIONAL_FINALS: "Your application has been accepted for national adjudication.",
  SUBMITTED: "Your application has been received and is awaiting review.",
  CHAPTER_REVIEW: "Your application has been approved for chapter adjudication.",
  CHAPTER_APPROVED:
    "Your application has been selected as a chapter winner and is awaiting national approval.",
  CHAPTER_REJECTED:
    "Your application has been excluded from this cycle. If you believe this is in error, please contact the program and we will review it with you.",
  NATIONAL_REVIEW: "Your application has been accepted for national adjudication.",
  NATIONAL_APPROVED: "This application is no longer active in the current cycle.",
  NATIONAL_REJECTED:
    "Your application has been excluded from this cycle. If you believe this is in error, please contact the program and we will review it with you.",
  DECIDED: "This application is no longer active in the current cycle.",
};

function baseLayout(body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f4f4f5; margin: 0; padding: 24px; }
    .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px; }
    p { color: #3f3f46; line-height: 1.6; margin: 0 0 16px; }
    a.button { display: inline-block; background: #18181b; color: #ffffff !important; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; margin-top: 8px; }
    .footer { margin-top: 24px; font-size: 12px; color: #a1a1aa; }
  </style>
</head>
<body>
  <div class="container">
    ${body}
    <div class="footer">AdjudicArts &mdash; Arts Adjudication Platform</div>
  </div>
</body>
</html>`;
}

export async function sendApplicationConfirmation(
  to: string,
  name: string,
  eventName: string,
  applicationId: string,
  statusUrl: string
) {
  const html = baseLayout(`
    <p>Hi ${name},</p>
    <p>We've received your application for <strong>${eventName}</strong>.</p>
    <p>Your application ID is <code>${applicationId}</code>. You can track its progress at any time using the link below.</p>
    <p>You'll hear from us with updates as your application is reviewed.</p>
    <a class="button" href="${statusUrl}">Check application status</a>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Application Received — ${eventName}`,
    html,
  });
}

export async function sendStatusUpdate(
  to: string,
  name: string,
  eventName: string,
  newStatus: ApplicationStatus,
  statusUrl: string
) {
  const message = STATUS_MESSAGES[newStatus];

  const html = baseLayout(`
    <p>Hi ${name},</p>
    <p>There's an update on your application for <strong>${eventName}</strong>.</p>
    <p>${message}</p>
    <a class="button" href="${statusUrl}">View application status</a>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Application Update — ${eventName}`,
    html,
  });
}

export async function sendWelcomeEmail(
  to: string,
  adminName: string,
  orgName: string
) {
  const html = baseLayout(`
    <p>Hi ${adminName},</p>
    <p>Welcome to AdjudicArts! Your organization <strong>${orgName}</strong> has been created.</p>
    <p>You're the administrator for your organization. You can now set up events, invite judges and chairs, and manage your adjudication workflows.</p>
    <a class="button" href="${process.env.NEXTAUTH_URL}/dashboard">Go to your dashboard &rarr;</a>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `Welcome to AdjudicArts — ${orgName}`,
    html,
  });
}

export async function sendInviteEmail(
  to: string,
  inviteUrl: string,
  roleLabel: string,
  invitedByName: string
) {
  const html = baseLayout(`
    <p>You've been invited to join AdjudicArts as a <strong>${roleLabel}</strong>.</p>
    <p>Invited by: ${invitedByName}</p>
    <p>Click the button below to set up your account. This link expires in 48 hours.</p>
    <a class="button" href="${inviteUrl}">Accept invitation &rarr;</a>
    <p style="margin-top:16px;font-size:13px;color:#71717a;">If you weren't expecting this invitation, you can safely ignore this email.</p>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "You're invited to AdjudicArts",
    html,
  });
}

export async function sendSupportNotification(
  to: string,
  orgName: string,
  subject: string,
  body: string,
  ticketUrl: string
) {
  const html = baseLayout(`
    <p><strong>New support ticket from ${orgName}</strong></p>
    <p><strong>Subject:</strong> ${subject}</p>
    <p><strong>Message:</strong></p>
    <p style="background:#f4f4f5;padding:12px;border-radius:6px;">${body.replace(/\n/g, "<br>")}</p>
    <a class="button" href="${ticketUrl}">View ticket &rarr;</a>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `[Support] ${subject} — ${orgName}`,
    html,
  });
}

export async function sendContactInquiry(
  to: string,
  name: string,
  email: string,
  organization: string | undefined,
  message: string
) {
  const orgLine = organization ? `<p><strong>Organization:</strong> ${organization}</p>` : "";
  const html = baseLayout(`
    <p><strong>New contact inquiry from ${name}</strong></p>
    <p><strong>Email:</strong> ${email}</p>
    ${orgLine}
    <p><strong>Message:</strong></p>
    <p style="background:#f4f4f5;padding:12px;border-radius:6px;">${message.replace(/\n/g, "<br>")}</p>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: `[Contact] ${name}${organization ? ` — ${organization}` : ""}`,
    html,
  });
}

export async function sendTicketReply(
  to: string,
  userName: string,
  replyBody: string,
  ticketUrl: string
) {
  const html = baseLayout(`
    <p>Hi ${userName},</p>
    <p>AdjudicArts support has replied to your ticket:</p>
    <p style="background:#f4f4f5;padding:12px;border-radius:6px;">${replyBody.replace(/\n/g, "<br>")}</p>
    <a class="button" href="${ticketUrl}">View your ticket &rarr;</a>
  `);

  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "AdjudicArts support replied to your ticket",
    html,
  });
}
