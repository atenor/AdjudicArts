import { Prisma, Role } from "@prisma/client";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  channelInApp: true,
  channelEmail: true,
  channelSms: false,
  frequency: "DAILY" as const,
  digestWeekday: 1,
  digestHour: 9,
  digestMinute: 0,
  timezone: "America/Indiana/Indianapolis",
};

const PENDING_APPROVAL_STATUSES = [
  "PENDING_APPROVAL",
  "CORRECTION_REQUIRED",
  "SUBMITTED_PENDING_APPROVAL",
  "SUBMITTED",
] as const;
const DIGEST_LINK_PATH = "/dashboard/applications?status=PENDING_APPROVAL";

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

function isWeeklyDigestWindowOpen(input: {
  now: Date;
  timezone: string;
  digestWeekday: number;
  digestHour: number;
  digestMinute: number;
}) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    weekday: "short",
  }).format(input.now);
  const weekdayIndexMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayIndex = weekdayIndexMap[weekday] ?? -1;
  if (weekdayIndex !== input.digestWeekday) return false;
  return isDigestWindowOpen(input);
}

function getIsoWeekKey(date: Date, timezone: string) {
  const localized = new Date(
    date.toLocaleString("en-US", { timeZone: timezone })
  );
  const day = (localized.getDay() + 6) % 7;
  localized.setDate(localized.getDate() - day + 3);
  const firstThursday = new Date(localized.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((localized.getTime() - firstThursday.getTime()) / 604800000);
  return `${localized.getFullYear()}-W${String(week).padStart(2, "0")}`;
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
  activityCount: number;
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
      <h2 style="margin: 0 0 12px; font-size: 20px;">Weekly Digest</h2>
      <p style="margin: 0 0 8px;">Hi ${input.recipientName},</p>
      <p style="margin: 0 0 8px;"><strong>Recent activity (7 days):</strong> ${input.activityCount}</p>
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
    digestWeekday?: number;
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

export async function countUnreadInAppNotificationsForUser(
  organizationId: string,
  userId: string
) {
  return prisma.notification.count({
    where: {
      organizationId,
      userId,
      channel: "IN_APP",
      readAt: null,
    },
  });
}

export async function markInAppNotificationsReadForUser(
  organizationId: string,
  userId: string
) {
  return prisma.notification.updateMany({
    where: {
      organizationId,
      userId,
      channel: "IN_APP",
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });
}

export async function createTestInAppNotificationForUser(
  organizationId: string,
  userId: string
) {
  return prisma.notification.create({
    data: {
      organizationId,
      userId,
      kind: "DAILY_DIGEST",
      channel: "IN_APP",
      title: "Test notification",
      body: "This is a test notification. If you can see this, in-app notifications are working.",
      linkUrl: "/dashboard/notifications",
      dedupeKey: `test-in-app:${userId}:${Date.now()}`,
    },
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

async function sendOrQueueNotificationEmail(input: {
  organizationId: string;
  userId: string;
  toEmail: string;
  subject: string;
  htmlBody: string;
  dedupeKey: string;
}) {
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
        dedupeKey: input.dedupeKey,
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
    console.info(
      `[notification-email-stub] queued email ${outboxId} for ${input.toEmail} (${input.subject})`
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
    digestWeekday: number;
    digestHour: number;
    digestMinute: number;
    timezone: string;
  } | null;
};

async function getDigestCountsForRecipient(recipient: DigestRecipient) {
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (recipient.role === "CHAPTER_CHAIR") {
    const chapter = recipient.chapter?.trim() || "";
    if (!chapter) {
      return { totalApplicants: 0, pendingApprovals: 0, activityCount: 0 };
    }

    const [totalApplicants, pendingApprovals, activityCount] = await Promise.all([
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
      prisma.application.count({
        where: {
          organizationId: recipient.organizationId,
          chapter: { equals: chapter, mode: "insensitive" },
          updatedAt: { gte: last7d },
        },
      }),
    ]);

    return { totalApplicants, pendingApprovals, activityCount };
  }

  const [totalApplicants, pendingApprovals, activityCount] = await Promise.all([
    prisma.application.count({
      where: { organizationId: recipient.organizationId },
    }),
    prisma.application.count({
      where: {
        organizationId: recipient.organizationId,
        status: { in: [...PENDING_APPROVAL_STATUSES] },
      },
    }),
    prisma.application.count({
      where: {
        organizationId: recipient.organizationId,
        updatedAt: { gte: last7d },
      },
    }),
  ]);

  return { totalApplicants, pendingApprovals, activityCount };
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
          digestWeekday: true,
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

    if (!isWeeklyDigestWindowOpen({
      now,
      timezone: preference.timezone,
      digestWeekday: preference.digestWeekday,
      digestHour: preference.digestHour,
      digestMinute: preference.digestMinute,
    })) {
      skipped += 1;
      continue;
    }

    const digestDate = getIsoWeekKey(now, preference.timezone);
    const { totalApplicants, pendingApprovals, activityCount } =
      await getDigestCountsForRecipient(recipient);
    if (activityCount === 0) {
      skipped += 1;
      continue;
    }
    const title = "Weekly Account Activity Digest";
    const scope =
      recipient.role === "CHAPTER_CHAIR"
        ? `Chapter ${recipient.chapter ?? "Unassigned"}`
        : "Organization";
    const body = `${scope}: ${activityCount} updates in the last 7 days, with ${pendingApprovals} pending approvals out of ${totalApplicants} applicants.`;

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
          activityCount,
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

export async function notifyApplicationSubmitted(input: {
  organizationId: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  chapter?: string | null;
  eventName: string;
}) {
  const chapter = input.chapter?.trim() || null;
  const recipients = await prisma.user.findMany({
    where: {
      organizationId: input.organizationId,
      OR: [
        { role: { in: ["ADMIN", "NATIONAL_CHAIR"] } },
        ...(chapter
          ? [
              {
                role: "CHAPTER_CHAIR",
                chapter: { equals: chapter, mode: "insensitive" },
              } as const,
            ]
          : []),
      ],
    },
    select: {
      id: true,
      organizationId: true,
      email: true,
      name: true,
      role: true,
      chapter: true,
      notificationPreference: {
        select: {
          enabled: true,
          channelInApp: true,
          channelEmail: true,
        },
      },
    },
  });

  const title = "New application submitted";
  const body = `${input.applicantName} submitted an application${chapter ? ` for ${chapter}` : ""} (${input.eventName}).`;
  const linkUrl = `/dashboard/applications/${input.applicationId}`;

  let deliveredInApp = 0;
  let queuedOrSentEmail = 0;

  for (const recipient of recipients) {
    const preference =
      recipient.notificationPreference ??
      (await getOrCreateNotificationPreference(recipient.id));
    if (!preference.enabled) continue;

    if (preference.channelInApp) {
      const dedupeKey = `application-submitted:in-app:${recipient.id}:${input.applicationId}`;
      try {
        await prisma.notification.create({
          data: {
            organizationId: recipient.organizationId,
            userId: recipient.id,
            kind: "DAILY_DIGEST",
            channel: "IN_APP",
            title,
            body,
            linkUrl,
            dedupeKey,
          },
        });
        deliveredInApp += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          // duplicate ignored
        } else {
          throw error;
        }
      }
    }

    if (preference.channelEmail) {
      const subject = "New application submitted";
      const htmlBody = `<!doctype html>
<html lang="en">
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f6f3fc; color: #1e1538; margin: 0; padding: 20px;">
    <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e2d9f1; border-radius: 12px; padding: 20px;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">New application submitted</h2>
      <p style="margin: 0 0 8px;">${input.applicantName} (${input.applicantEmail}) submitted an application.</p>
      <p style="margin: 0 0 8px;"><strong>Event:</strong> ${input.eventName}</p>
      ${chapter ? `<p style="margin: 0 0 8px;"><strong>Chapter:</strong> ${chapter}</p>` : ""}
      <p style="margin: 16px 0 0;">
        <a href="${new URL(linkUrl, process.env.NEXTAUTH_URL ?? "http://localhost:3000").toString()}" style="display:inline-block;background:#5f2ec8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">
          Open application
        </a>
      </p>
    </div>
  </body>
</html>`;

      const emailStatus = await sendOrQueueNotificationEmail({
        organizationId: recipient.organizationId,
        userId: recipient.id,
        toEmail: recipient.email,
        subject,
        htmlBody,
        dedupeKey: `application-submitted:email:${recipient.id}:${input.applicationId}`,
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
  };
}
