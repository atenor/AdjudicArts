import { Resend } from "resend";
import { ApplicationStatus } from "@prisma/client";

// Lazy-initialize so the missing key in build/dev doesn't throw at module load time
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM_ADDRESS = "AdjudicArts <noreply@adjudicarts.dev>";

const STATUS_MESSAGES: Record<ApplicationStatus, string> = {
  SUBMITTED_PENDING_APPROVAL:
    "Your application has been received and is awaiting approval.",
  CHAPTER_ADJUDICATION:
    "Your application is now in chapter adjudication.",
  NATIONAL_FINALS:
    "Your application has advanced to national finals.",
  SUBMITTED:
    "Your application has been received and is awaiting approval.",
  CHAPTER_REVIEW:
    "Your application is currently in chapter adjudication.",
  CHAPTER_APPROVED:
    "Congratulations! Your application has been approved to advance to national finals.",
  CHAPTER_REJECTED:
    "Thank you for applying. Unfortunately your application was not selected to advance at this time.",
  NATIONAL_REVIEW:
    "Your application is currently in national finals adjudication.",
  NATIONAL_APPROVED:
    "Congratulations! Your application has been approved.",
  NATIONAL_REJECTED:
    "Thank you for applying. Unfortunately your application was not selected.",
  DECIDED:
    "A final decision has been made. Please check your email for details.",
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
