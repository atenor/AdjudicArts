import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import InviteUserModal from "@/components/admin/invite-user-modal";
import styles from "./users.module.css";

export default async function UsersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) redirect("/dashboard");

  const { organizationId } = session.user;
  const now = new Date();

  const [users, pendingInvites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      select: { id: true, name: true, email: true, role: true, chapter: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inviteToken.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: now } },
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
          <h1 className={styles.heading}>Team members</h1>
          <p className={styles.sub}>{users.length} user{users.length !== 1 ? "s" : ""} in your organization</p>
        </div>
        <InviteUserModal />
      </div>

      {/* Active users */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Active users</h2>
        {users.length === 0 ? (
          <p className={styles.empty}>No users yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Chapter</th>
                  <th>Joined</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pending invites</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited by</th>
                  <th>Expires</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
