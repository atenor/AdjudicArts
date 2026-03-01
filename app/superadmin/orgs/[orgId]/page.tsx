import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS } from "@/lib/roles";
import { Role } from "@prisma/client";
import ImpersonateButton from "@/components/admin/impersonate-button";
import OrgStatusEditor from "@/components/admin/org-status-editor";
import styles from "./org-detail.module.css";

export default async function OrgDetailPage({ params }: { params: { orgId: string } }) {
  const now = new Date();
  const [org, users, pendingInvites, events] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.orgId } }),
    prisma.user.findMany({
      where: { organizationId: params.orgId },
      select: { id: true, name: true, email: true, role: true, chapter: true, createdAt: true },
      orderBy: { role: "asc" },
    }),
    prisma.inviteToken.findMany({
      where: { organizationId: params.orgId, acceptedAt: null, expiresAt: { gt: now } },
      select: { id: true, email: true, role: true, expiresAt: true, invitedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.event.findMany({
      where: { organizationId: params.orgId },
      select: { id: true, name: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!org) notFound();

  const adminUser = users.find((u) => u.role === Role.ADMIN);

  return (
    <div>
      <div className={styles.breadcrumb}>
        <Link href="/superadmin" className={styles.breadcrumbLink}>Dashboard</Link>
        <span className={styles.breadcrumbSep}>/</span>
        <span>{org.name}</span>
      </div>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.heading}>{org.name}</h1>
          <p className={styles.sub}>
            {users.length} user{users.length !== 1 ? "s" : ""}
            {" · "}
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          {adminUser && (
            <ImpersonateButton targetUserId={adminUser.id} orgName={org.name} />
          )}
        </div>
      </div>

      {/* Org settings */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Organization settings</h2>
        <OrgStatusEditor orgId={org.id} currentPlan={org.plan} currentStatus={org.status} />
      </section>

      {/* Users */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Users ({users.length})</h2>
        {users.length === 0 ? (
          <p className={styles.empty}>No users.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Chapter</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className={styles.nameCell}>{u.name}</td>
                    <td className={styles.dimCell}>{u.email}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`role_${u.role}`]}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className={styles.dimCell}>{u.chapter ?? "—"}</td>
                    <td className={styles.dimCell}>
                      {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
          <h2 className={styles.sectionTitle}>Pending invites ({pendingInvites.length})</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Email</th><th>Role</th><th>Invited by</th><th>Expires</th></tr>
              </thead>
              <tbody>
                {pendingInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className={styles.dimCell}>{inv.email}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`role_${inv.role}`]}`}>
                        {ROLE_LABELS[inv.role] ?? inv.role}
                      </span>
                    </td>
                    <td className={styles.dimCell}>{inv.invitedBy?.name ?? "—"}</td>
                    <td className={styles.dimCell}>
                      {new Date(inv.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Events */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Events ({events.length})</h2>
        {events.length === 0 ? (
          <p className={styles.empty}>No events yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Name</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className={styles.nameCell}>{ev.name}</td>
                    <td className={styles.dimCell}>{ev.status}</td>
                    <td className={styles.dimCell}>
                      {new Date(ev.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
