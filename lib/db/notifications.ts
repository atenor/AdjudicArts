import { Prisma, Role } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  channelInApp: true,
  channelEmail: true,
  channelSms: false,
  frequency: "DAILY" as const,
  digestHour: 9,
  digestMinute: 0,
  timezone: "America/Indiana/Indianapolis",
};

const PENDING_APPROVAL_STATUSES = ["SUBMITTED_PENDING_APPROVAL", "SUBMITTED"] as const;
const DIGEST_LINK_PATH = "/dashboard/applications?status=SUBMITTED_PENDING_APPROVAL";

function getTimePartsInZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = String(map.year ?? "0000");
  const month = String(map.month ?? "01");
  const day = String(map.day ?? "01");
  const hour = Number(map.hour ?? "0");
  const minute = Number(map.minute ?? "0");

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

function isDigestWindowOpen(input: {
  now: Date;
  timezone: string;
  digestHour: number;
  digestMinute: number;
}) {
  const parts = getTimePartsInZone(input.now, input.timezone);
  if (parts.hour !== input.digestHour) return false;
  return parts.minute >= input.digestMinute && parts.minute < input.digestMinute + 15;
}

function pendingApprovalLinkAbsolute() {
  const base = process.env.NEXTAUTH_URL?.trim();
  if (!base) return DIGEST_LINK_PATH;
  try {
    return new URL(DIGEST_LINK_PATH, base).toString();
  } catch {
    return `${base.replace(/\/+$/, "")}${DIGEST_LINK_PATH}`;
  }
}

function digestEmailHtml(input: {
  recipientName: string;
  totalApplicants: number;
  pendingApprovals: number;
  chapterLabel?: string | null;
  absoluteLink: string;
}) {
  const chapterText = input.chapterLabel ? `<p><strong>Chapter:</strong> ${input.chapterLabel}</p>` : "";
  return `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f3fc; color: #1e1538; margin: 0; padding: 20px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2d9f1; border-radius: 12px; padding: 20px;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">Daily Digest</h2>
      <p style="margin: 0 0 8px;">Hi ${input.recipientName},</p>
      <p style="margin: 0 0 8px;"><strong>Total applicants:</strong> ${input.totalApplicants}</p>
      <p style="margin: 0 0 8px;"><strong>Pending approvals:</strong> ${input.pendingApprovals}</p>
      ${chapterText}
      <p style="margin: 16px 0 0;">
        <a href="${input.absoluteLink}" style="display:inline-block;background:#5f2ec8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">
          Open Pending Approval List
        </a>
      </p>
    </div>
  </body>
</html>`;
}

export async function getOrCreateNotificationPreference(userId: string) {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.notificationPreference.create({
    data: {
      userId,
      ...DEFAULT_NOTIFICATION_PREFS,
    },
  });
}

export async function updateNotificationPreference(
  userId: string,
  input: {
    enabled?: boolean;
    channelInApp?: boolean;
    channelEmail?: boolean;
    channelSms?: boolean;
    digestHour?: number;
    digestMinute?: number;
    timezone?: string;
  }
) {
  await getOrCreateNotificationPreference(userId);
  return prisma.notificationPreference.update({
    where: { userId },
    data: {
      ...input,
      frequency: "DAILY",
    },
  });
}

export async function listInAppNotificationsForUser(
  organizationId: string,
  userId: string,
  limit = 30
) {
  return prisma.notification.findMany({
    where: {
      organizationId,
      userId,
      channel: "IN_APP",
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

async function createInAppDigestNotification(input: {
  organizationId: string;
  userId: string;
  title: string;
  body: string;
  digestDate: string;
}) {
  const dedupeKey = `daily-digest:in-app:${input.userId}:${input.digestDate}`;
  try {
    await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        kind: "DAILY_DIGEST",
        channel: "IN_APP",
        title: input.title,
        body: input.body,
        linkUrl: DIGEST_LINK_PATH,
        digestDate: input.digestDate,
        dedupeKey,
      },
    });
    return { created: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { created: false };
    }
    throw error;
  }
}

async function sendOrQueueDigestEmail(input: {
  organizationId: string;
  userId: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
  digestDate: string;
}) {
  const dedupeKey = `daily-digest:email:${input.userId}:${input.digestDate}`;
  let outboxId: string | null = null;

  try {
    const outbox = await prisma.outboundEmail.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        toEmail: input.toEmail,
        subject: input.subject,
        htmlBody: input.htmlBody,
        status: "PENDING",
        provider: process.env.RESEND_API_KEY ? "resend" : "stub",
        digestDate: input.digestDate,
        dedupeKey,
      },
      select: { id: true },
    });
    outboxId = outbox.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "SKIPPED_DUPLICATE" as const };
    }
    throw error;
  }

  if (!process.env.RESEND_API_KEY) {
    // TODO: If a different provider is adopted, replace this stub queue handler.
    console.info(
      `[digest-email-stub] queued email ${outboxId} for ${input.toEmail} (${input.subject})`
    );
    return { status: "QUEUED_STUB" as const };
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const response = await resend.emails.send({
      from: "AdjudicArts <noreply@adjudicarts.dev>",
      to: input.toEmail,
      subject: input.subject,
      html: input.htmlBody,
    });

    await prisma.outboundEmail.update({
      where: { id: outboxId! },
      data: {
        status: "SENT",
        providerMessageId: response.data?.id ?? null,
        sentAt: new Date(),
      },
    });

    return { status: "SENT" as const };
  } catch (error) {
    await prisma.outboundEmail.update({
      where: { id: outboxId! },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown email error",
      },
    });
    return { status: "FAILED" as const };
  }
}

type DigestRecipient = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  chapter: string | null;
  role: Role;
  notificationPreference: {
    enabled: boolean;
    channelInApp: boolean;
    channelEmail: boolean;
    channelSms: boolean;
    frequency: "DAILY";
    digestHour: number;
    digestMinute: number;
    timezone: string;
  } | null;
};

async function getDigestCountsForRecipient(recipient: DigestRecipient) {
  if (recipient.role === "CHAPTER_CHAIR") {
    const chapter = recipient.chapter?.trim() || "";
    if (!chapter) {
      return { totalApplicants: 0, pendingApprovals: 0 };
    }

    const [totalApplicants, pendingApprovals] = await Promise.all([
      prisma.application.count({
        where: {
          organizationId: recipient.organizationId,
          chapter: { equals: chapter, mode: "insensitive" },
        },
      }),
      prisma.application.count({
        where: {
          organizationId: recipient.organizationId,
          chapter: { equals: chapter, mode: "insensitive" },
          status: { in: [...PENDING_APPROVAL_STATUSES] },
        },
      }),
    ]);

    return { totalApplicants, pendingApprovals };
  }

  const [totalApplicants, pendingApprovals] = await Promise.all([
    prisma.application.count({
      where: { organizationId: recipient.organizationId },
    }),
    prisma.application.count({
      where: {
        organizationId: recipient.organizationId,
        status: { in: [...PENDING_APPROVAL_STATUSES] },
      },
    }),
  ]);

  return { totalApplicants, pendingApprovals };
}

export async function runDailyDigest(now = new Date()) {
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: ["ADMIN", "NATIONAL_CHAIR", "CHAPTER_CHAIR"] },
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      name: true,
      chapter: true,
      role: true,
      notificationPreference: {
        select: {
          enabled: true,
          channelInApp: true,
          channelEmail: true,
          channelSms: true,
          frequency: true,
          digestHour: true,
          digestMinute: true,
          timezone: true,
        },
      },
    },
  });

  let deliveredInApp = 0;
  let queuedOrSentEmail = 0;
  let skipped = 0;

  for (const recipient of recipients) {
    const preference =
      recipient.notificationPreference ??
      (await getOrCreateNotificationPreference(recipient.id));
    if (!preference.enabled || preference.frequency !== "DAILY") {
      skipped += 1;
      continue;
    }

    if (
      !isDigestWindowOpen({
        now,
        timezone: preference.timezone,
        digestHour: preference.digestHour,
        digestMinute: preference.digestMinute,
      })
    ) {
      skipped += 1;
      continue;
    }

    const zoneParts = getTimePartsInZone(now, preference.timezone);
    const digestDate = zoneParts.dateKey;
    const { totalApplicants, pendingApprovals } = await getDigestCountsForRecipient(recipient);
    const title = "Daily Pending Approval Digest";
    const scope =
      recipient.role === "CHAPTER_CHAIR"
        ? `Chapter ${recipient.chapter ?? "Unassigned"}`
        : "Organization";
    const body = `${scope}: ${pendingApprovals} pending approvals out of ${totalApplicants} applicants.`;

    if (preference.channelInApp) {
      const created = await createInAppDigestNotification({
        organizationId: recipient.organizationId,
        userId: recipient.id,
        title,
        body,
        digestDate,
      });
      if (created.created) deliveredInApp += 1;
    }

    if (preference.channelEmail) {
      const emailStatus = await sendOrQueueDigestEmail({
        organizationId: recipient.organizationId,
        userId: recipient.id,
        toEmail: recipient.email,
        subject: title,
        htmlBody: digestEmailHtml({
          recipientName: recipient.name,
          totalApplicants,
          pendingApprovals,
          chapterLabel: recipient.role === "CHAPTER_CHAIR" ? recipient.chapter : null,
          absoluteLink: pendingApprovalLinkAbsolute(),
        }),
        digestDate,
      });
      if (emailStatus.status !== "SKIPPED_DUPLICATE") {
        queuedOrSentEmail += 1;
      }
    }
  }

  return {
    recipients: recipients.length,
    deliveredInApp,
    queuedOrSentEmail,
    skipped,
  };
}
