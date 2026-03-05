export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import {
  createTestInAppNotificationForUser,
  markInAppNotificationsReadForUser,
  getOrCreateNotificationPreference,
  listInAppNotificationsForUser,
  updateNotificationPreference,
} from "@/lib/db/notifications";

export const metadata: Metadata = { title: "Notifications" };

function formatDate(value: Date) {
  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams?: { saved?: string; tested?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const [preference, notifications] = await Promise.all([
    getOrCreateNotificationPreference(session.user.id),
    listInAppNotificationsForUser(session.user.organizationId, session.user.id),
  ]);
  await markInAppNotificationsReadForUser(session.user.organizationId, session.user.id);

  async function savePreferences(formData: FormData) {
    "use server";
    const latestSession = await getServerSession(authOptions);
    if (!latestSession) redirect("/login");

    const digestHourRaw = Number(formData.get("digestHour") ?? preference.digestHour);
    const digestMinuteRaw = Number(formData.get("digestMinute") ?? preference.digestMinute);
    const digestWeekdayRaw = Number(formData.get("digestWeekday"));
    const digestHour = Number.isFinite(digestHourRaw)
      ? Math.min(23, Math.max(0, Math.round(digestHourRaw)))
      : 9;
    const digestMinute = Number.isFinite(digestMinuteRaw)
      ? Math.min(59, Math.max(0, Math.round(digestMinuteRaw)))
      : 0;
    const digestWeekday = Number.isFinite(digestWeekdayRaw)
      ? Math.min(6, Math.max(0, Math.round(digestWeekdayRaw)))
      : 1;

    await updateNotificationPreference(latestSession.user.id, {
      enabled: formData.get("enabled") === "on",
      channelInApp: formData.get("channelInApp") === "on",
      channelEmail: formData.get("channelEmail") === "on",
      channelSms: formData.get("channelSms") === "on",
      digestWeekday,
      digestHour,
      digestMinute,
      timezone:
        String(formData.get("timezone") ?? "").trim() ||
        "America/Indiana/Indianapolis",
    });

    revalidatePath("/dashboard/notifications");
    redirect("/dashboard/notifications?saved=1");
  }

  async function sendTestNotification() {
    "use server";
    const latestSession = await getServerSession(authOptions);
    if (!latestSession) redirect("/login");
    await createTestInAppNotificationForUser(
      latestSession.user.organizationId,
      latestSession.user.id
    );
    revalidatePath("/dashboard/notifications");
    redirect("/dashboard/notifications?tested=1");
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[#1e1538]">Notifications</h1>
        <Link
          href="/dashboard/applications?status=PENDING_APPROVAL"
          className="rounded-full border border-[#c7b7e5] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#4a3d6b] hover:bg-[#f4effb]"
        >
          Open Pending Approval List
        </Link>
      </header>

      {searchParams?.saved === "1" ? (
        <div className="rounded-xl border border-[#b8e9d1] bg-[#d6f6e8] px-4 py-3 text-sm font-medium text-[#0d7b5f]">
          Notification preferences saved.
        </div>
      ) : null}
      {searchParams?.tested === "1" ? (
        <div className="rounded-xl border border-[#b8e9d1] bg-[#d6f6e8] px-4 py-3 text-sm font-medium text-[#0d7b5f]">
          Test notification sent.
        </div>
      ) : null}

      <section className="rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1e1538]">Notification Preferences</h2>
        <p className="mt-1 text-sm text-[#6d5b91]">
          Weekly digest sends on your selected day and time, and only when there has been account activity.
        </p>
        {searchParams?.saved === "1" ? (
          <div className="mt-3 rounded-xl border-2 border-[#83d5b6] bg-[#d6f6e8] px-4 py-3 text-base font-semibold text-[#0d7b5f] shadow-sm">
            Saved successfully. Your notification preferences were updated.
          </div>
        ) : null}
        <form action={savePreferences} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-[#2b2350]">
            <input type="checkbox" name="enabled" defaultChecked={preference.enabled} />
            Notifications enabled
          </label>
          <label className="flex items-center gap-2 text-sm text-[#2b2350]">
            <input
              type="checkbox"
              name="channelInApp"
              defaultChecked={preference.channelInApp}
            />
            In-app notifications
          </label>
          <label className="flex items-center gap-2 text-sm text-[#2b2350]">
            <input
              type="checkbox"
              name="channelEmail"
              defaultChecked={preference.channelEmail}
            />
            Email notifications
          </label>
          <label className="flex items-center gap-2 text-sm text-[#2b2350]">
            <input type="checkbox" name="channelSms" defaultChecked={preference.channelSms} />
            SMS notifications (opt-in)
          </label>
          <label className="grid gap-1 text-sm text-[#2b2350]">
            Weekly digest day
            <select
              name="digestWeekday"
              defaultValue={String(preference.digestWeekday ?? 1)}
              className="rounded-md border border-[#d7cde9] bg-white px-2 py-1.5"
            >
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="2">Tuesday</option>
              <option value="3">Wednesday</option>
              <option value="4">Thursday</option>
              <option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-[#2b2350]">
            Weekly digest hour (0-23)
            <input
              type="number"
              name="digestHour"
              min={0}
              max={23}
              defaultValue={preference.digestHour}
              className="rounded-md border border-[#d7cde9] bg-white px-2 py-1.5"
            />
          </label>
          <label className="grid gap-1 text-sm text-[#2b2350]">
            Weekly digest minute (0-59)
            <input
              type="number"
              name="digestMinute"
              min={0}
              max={59}
              defaultValue={preference.digestMinute}
              className="rounded-md border border-[#d7cde9] bg-white px-2 py-1.5"
            />
          </label>
          <label className="grid gap-1 text-sm text-[#2b2350] sm:col-span-2">
            Timezone
            <input
              type="text"
              name="timezone"
              defaultValue={preference.timezone}
              className="rounded-md border border-[#d7cde9] bg-white px-2 py-1.5"
            />
          </label>
          <div className="sm:col-span-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="rounded-md border border-[#4d2d91] bg-[#5f2ec8] px-3 py-2 text-sm font-semibold text-white hover:bg-[#5327b2]"
              >
                Save Notification Preferences
              </button>
              <button
                type="submit"
                formAction={sendTestNotification}
                className="rounded-md border border-[#c7b7e5] bg-white px-3 py-2 text-sm font-semibold text-[#4a3d6b] hover:bg-[#f4effb]"
              >
                Send test notification
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-[#1e1538]">In-App Notifications</h2>
        {notifications.length === 0 ? (
          <p className="mt-3 text-sm text-[#6d5b91]">No notifications yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="rounded-lg border border-[#e1d8f1] bg-[#faf7ff] p-3"
              >
                <p className="text-sm font-semibold text-[#2b2350]">{notification.title}</p>
                <p className="mt-1 text-sm text-[#4a3d6b]">{notification.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-[#7b6e9d]">{formatDate(notification.createdAt)}</p>
                  {notification.linkUrl ? (
                    <Link
                      href={notification.linkUrl}
                      className="text-xs font-semibold text-[#5f2ec8] underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
