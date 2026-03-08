export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import InviteUserModal from "@/components/admin/invite-user-modal";
import UserRowActions from "@/components/admin/user-row-actions";
import ManualUserModal from "@/components/admin/manual-user-modal";
import CancelInviteButton from "@/components/admin/cancel-invite-button";
import {
  createTestInAppNotificationForUser,
  markInAppNotificationsReadForUser,
  getOrCreateNotificationPreference,
  listInAppNotificationsForUser,
  updateNotificationPreference,
} from "@/lib/db/notifications";

export const metadata: Metadata = { title: "Settings" };

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
  const isUserManager =
    session.user.role === Role.ADMIN ||
    session.user.role === Role.NATIONAL_CHAIR ||
    session.user.role === Role.CHAPTER_CHAIR;
  const chairChapter = session.user.chapter?.trim() ?? null;
  const now = new Date();

  const [users, pendingInvites] = isUserManager
    ? await Promise.all([
        prisma.user.findMany({
          where:
            session.user.role === Role.CHAPTER_CHAIR
              ? {
                  organizationId: session.user.organizationId,
                  role: Role.CHAPTER_JUDGE,
                  chapter: chairChapter ?? "__NO_MATCH__",
                }
              : { organizationId: session.user.organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            chapter: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.inviteToken.findMany({
          where:
            session.user.role === Role.CHAPTER_CHAIR
              ? {
                  organizationId: session.user.organizationId,
                  role: Role.CHAPTER_JUDGE,
                  invitedById: session.user.id,
                  acceptedAt: null,
                  expiresAt: { gt: now },
                }
              : {
                  organizationId: session.user.organizationId,
                  acceptedAt: null,
                  expiresAt: { gt: now },
                },
          select: {
            id: true,
            email: true,
            role: true,
            name: true,
            expiresAt: true,
            invitedBy: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ])
    : [[], []];

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
        <h1 className="text-2xl font-semibold text-[#1e1538]">Settings</h1>
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

      <section className="rounded-xl border border-[#d8cce9] bg-white shadow-sm">
        <div className="border-b border-[#e7def3] px-4 py-3">
          <h2 className="text-lg font-semibold text-[#1e1538]">Notifications</h2>
          <p className="mt-1 text-sm text-[#6d5b91]">
            Notification Preferences and In-App Notifications are grouped here.
          </p>
        </div>

        <details className="border-b border-[#e7def3]" open={false}>
          <summary className="cursor-pointer list-none px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-[#1e1538]">Notification Preferences</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6d5b91]">
                Click to open
              </span>
            </div>
          </summary>
          <div className="px-4 pb-4 pt-2">
            {searchParams?.saved === "1" ? (
              <div className="mt-1 rounded-xl border-2 border-[#83d5b6] bg-[#d6f6e8] px-4 py-3 text-base font-semibold text-[#0d7b5f] shadow-sm">
                Saved successfully. Your notification preferences were updated.
              </div>
            ) : null}
            <form action={savePreferences} className="mt-3 grid gap-3 sm:grid-cols-2">
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
          </div>
        </details>

        <details open={false}>
          <summary className="cursor-pointer list-none px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-[#1e1538]">In-App Notifications</p>
              <span className="text-xs font-semibold uppercase tracking-wide text-[#6d5b91]">
                Click to open
              </span>
            </div>
          </summary>
          <div className="border-t border-[#e7def3] px-4 pb-4 pt-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-[#6d5b91]">No notifications yet.</p>
            ) : (
              <ul className="space-y-2">
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
          </div>
        </details>
      </section>

      {isUserManager ? (
        <section className="rounded-xl border border-[#d8cce9] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#1e1538]">Users</h2>
              <p className="mt-1 text-sm text-[#6d5b91]">
                {session.user.role === Role.CHAPTER_CHAIR
                  ? `Manage chapter judges for ${chairChapter ?? "your chapter"}.`
                  : "Manage users and invites for your organization."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <InviteUserModal
                triggerLabel={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? "Invite chapter judge"
                    : "Invite user"
                }
                title={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? "Invite a chapter judge"
                    : "Invite a team member"
                }
                allowedRoles={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? [Role.CHAPTER_JUDGE]
                    : undefined
                }
                helperText={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? `Invites created here are limited to Chapter Judge and automatically assigned to ${chairChapter ?? "your chapter"}.`
                    : undefined
                }
              />
              <ManualUserModal
                triggerLabel={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? "Add chapter judge manually"
                    : "Add user manually"
                }
                title={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? "Add a chapter judge manually"
                    : "Add a user manually"
                }
                allowedRoles={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? [Role.CHAPTER_JUDGE]
                    : undefined
                }
                fixedChapter={session.user.role === Role.CHAPTER_CHAIR ? chairChapter : null}
                helperText={
                  session.user.role === Role.CHAPTER_CHAIR
                    ? `Use this when email invites are unavailable. New users are created directly in ${chairChapter ?? "your chapter"}.`
                    : "Use this when email invites are unavailable. This creates the account immediately."
                }
              />
            </div>
          </div>

          <details className="mt-4 rounded-xl border border-[#e7def3]" open={false}>
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-[#1e1538]">Active Users</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6d5b91]">
                  {users.length}
                </span>
              </div>
            </summary>
            <div className="border-t border-[#e7def3] overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e7def3] text-left text-xs uppercase tracking-[0.06em] text-[#8a7fa8]">
                    <th className="px-4 py-2">Profile name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Chapter</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[#f1ebf9] last:border-b-0">
                      <td className="px-4 py-2 font-medium text-[#1e1538]">{u.name ?? "—"}</td>
                      <td className="px-4 py-2 text-[#4a3d6b]">{u.email}</td>
                      <td className="px-4 py-2 text-[#4a3d6b]">{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td className="px-4 py-2 text-[#6d5b91]">{u.chapter ?? "—"}</td>
                      <td className="px-4 py-2">
                        <UserRowActions
                          user={{
                            id: u.id,
                            name: u.name ?? "—",
                            email: u.email,
                            role: u.role,
                            chapter: u.chapter,
                          }}
                          isChapterChair={session.user.role === Role.CHAPTER_CHAIR}
                          chairChapter={chairChapter}
                          canEditRole={session.user.role !== Role.CHAPTER_CHAIR}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details className="mt-3 rounded-xl border border-[#e7def3]" open={false}>
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-[#1e1538]">Pending Invites</p>
                <span className="text-xs font-semibold uppercase tracking-wide text-[#6d5b91]">
                  {pendingInvites.length}
                </span>
              </div>
            </summary>
            <div className="border-t border-[#e7def3] overflow-x-auto">
              {pendingInvites.length === 0 ? (
                <p className="px-4 py-3 text-sm text-[#6d5b91]">No pending invites.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e7def3] text-left text-xs uppercase tracking-[0.06em] text-[#8a7fa8]">
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Invited by</th>
                      <th className="px-4 py-2">Expires</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvites.map((inv) => (
                      <tr key={inv.id} className="border-b border-[#f1ebf9] last:border-b-0">
                        <td className="px-4 py-2 text-[#4a3d6b]">{inv.email}</td>
                        <td className="px-4 py-2 text-[#4a3d6b]">{ROLE_LABELS[inv.role] ?? inv.role}</td>
                        <td className="px-4 py-2 text-[#6d5b91]">{inv.invitedBy?.name ?? "—"}</td>
                        <td className="px-4 py-2 text-[#6d5b91]">
                          {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-2">
                          <CancelInviteButton inviteId={inv.id} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        </section>
      ) : null}
    </div>
  );
}
