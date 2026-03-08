import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import InviteUserModal from "@/components/admin/invite-user-modal";
import UserRowActions from "@/components/admin/user-row-actions";
import ManualUserModal from "@/components/admin/manual-user-modal";
import CancelInviteButton from "@/components/admin/cancel-invite-button";
import styles from "./users.module.css";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    (session.user.role !== Role.ADMIN &&
      session.user.role !== Role.NATIONAL_CHAIR &&
      session.user.role !== Role.CHAPTER_CHAIR)
  ) {
    redirect("/dashboard");
  }

  const { organizationId } = session.user;
  const now = new Date();
  const isChapterChair = session.user.role === Role.CHAPTER_CHAIR;
  const chairChapter = session.user.chapter?.trim() ?? null;

  const userWhere = isChapterChair
    ? {
        organizationId,
        role: Role.CHAPTER_JUDGE,
        chapter: chairChapter ?? "__NO_MATCH__",
      }
    : { organizationId };

  const inviteWhere = isChapterChair
    ? {
        organizationId,
        role: Role.CHAPTER_JUDGE,
        invitedById: session.user.id,
        acceptedAt: null as Date | null,
        expiresAt: { gt: now },
      }
    : { organizationId, acceptedAt: null as Date | null, expiresAt: { gt: now } };

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true, email: true, role: true, chapter: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inviteToken.findMany({
      where: inviteWhere,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>{isChapterChair ? "Chapter Judges" : "Team members"}</h1>
          <p className={styles.sub}>
            {users.length} user{users.length !== 1 ? "s" : ""}
            {isChapterChair ? ` in ${chairChapter ?? "your chapter"}` : " in your organization"}
          </p>
        </div>
        <div className={styles.actionGroup}>
          <InviteUserModal
            triggerLabel={isChapterChair ? "Invite chapter judge" : "Invite user"}
            title={isChapterChair ? "Invite a chapter judge" : "Invite a team member"}
            allowedRoles={
              isChapterChair ? [Role.CHAPTER_JUDGE] : undefined
            }
            helperText={
              isChapterChair
                ? `Invites created here are limited to Chapter Judge and automatically assigned to ${chairChapter ?? "your chapter"}.`
                : undefined
            }
          />
          <ManualUserModal
            triggerLabel={isChapterChair ? "Add chapter judge manually" : "Add user manually"}
            title={isChapterChair ? "Add a chapter judge manually" : "Add a user manually"}
            allowedRoles={isChapterChair ? [Role.CHAPTER_JUDGE] : undefined}
            fixedChapter={isChapterChair ? chairChapter : null}
            helperText={
              isChapterChair
                ? `Use this when email invites are unavailable. New users are created directly in ${chairChapter ?? "your chapter"}.`
                : "Use this when email invites are unavailable. This creates the account immediately."
            }
          />
        </div>
      </div>

      {/* Active users */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isChapterChair ? "Active chapter judges" : "Active users"}</h2>
        {users.length === 0 ? (
          <p className={styles.empty}>No users yet.</p>
        ) : (
          <>
          <div className={`${styles.tableWrap} ${styles.desktopTable}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Profile name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Chapter</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className={styles.nameCell}>{u.name}</td>
                    <td className={styles.emailCell}>{u.email}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge_${u.role}`]}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className={styles.dimCell}>{u.chapter ?? "—"}</td>
                    <td className={styles.dimCell}>
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <UserRowActions
                        user={{
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          role: u.role,
                          chapter: u.chapter,
                        }}
                        isChapterChair={isChapterChair}
                        chairChapter={chairChapter}
                        canEditRole={!isChapterChair}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobileCards}>
            {users.map((u) => (
              <article key={u.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <p className={styles.mobileName}>{u.name}</p>
                  <span className={`${styles.badge} ${styles[`badge_${u.role}`]}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </div>
                <div className={styles.mobileMetaGrid}>
                  <div>
                    <p className={styles.mobileLabel}>Email</p>
                    <p className={styles.mobileValue}>{u.email}</p>
                  </div>
                  <div>
                    <p className={styles.mobileLabel}>Chapter</p>
                    <p className={styles.mobileValue}>{u.chapter ?? "—"}</p>
                  </div>
                  <div>
                    <p className={styles.mobileLabel}>Joined</p>
                    <p className={styles.mobileValue}>
                      {new Date(u.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className={styles.mobileActions}>
                  <UserRowActions
                    user={{
                      id: u.id,
                      name: u.name,
                      email: u.email,
                      role: u.role,
                      chapter: u.chapter,
                    }}
                    isChapterChair={isChapterChair}
                    chairChapter={chairChapter}
                    canEditRole={!isChapterChair}
                  />
                </div>
              </article>
            ))}
          </div>
          </>
        )}
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pending invites</h2>
          <div className={`${styles.tableWrap} ${styles.desktopTable}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited by</th>
                  <th>Expires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className={styles.emailCell}>{inv.email}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`badge_${inv.role}`]}`}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                    </td>
                    <td className={styles.dimCell}>{inv.invitedBy?.name ?? "—"}</td>
                    <td className={styles.dimCell}>
                      {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td>
                      <CancelInviteButton inviteId={inv.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.mobileCards}>
            {pendingInvites.map((inv) => (
              <article key={inv.id} className={styles.mobileCard}>
                <div className={styles.mobileCardHeader}>
                  <p className={styles.mobileName}>{inv.email}</p>
                  <span className={`${styles.badge} ${styles[`badge_${inv.role}`]}`}>
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                </div>
                <div className={styles.mobileMetaGrid}>
                  <div>
                    <p className={styles.mobileLabel}>Invited by</p>
                    <p className={styles.mobileValue}>{inv.invitedBy?.name ?? "—"}</p>
                  </div>
                  <div>
                    <p className={styles.mobileLabel}>Expires</p>
                    <p className={styles.mobileValue}>
                      {new Date(inv.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                <div className={styles.mobileActions}>
                  <CancelInviteButton inviteId={inv.id} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
