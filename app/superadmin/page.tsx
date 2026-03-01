import Link from "next/link";
import { prisma } from "@/lib/prisma";
import styles from "./dashboard.module.css";

export default async function SuperAdminDashboard() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [orgs, totalUsers, recentInvites, openTickets] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true, events: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count(),
    prisma.inviteToken.count({ where: { createdAt: { gt: thirtyDaysAgo } } }),
    prisma.supportTicket.count({ where: { status: { not: "resolved" } } }),
  ]);

  const activeOrgs = orgs.filter((o) => o.status === "active").length;
  const trialOrgs = orgs.filter((o) => o.status === "trial").length;

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Platform dashboard</h1>
      </div>

      {/* Metrics */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <p className={styles.metricVal}>{orgs.length}</p>
          <p className={styles.metricLabel}>Total orgs</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricVal}>{activeOrgs}</p>
          <p className={styles.metricLabel}>Active</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricVal}>{trialOrgs}</p>
          <p className={styles.metricLabel}>Trial</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricVal}>{totalUsers}</p>
          <p className={styles.metricLabel}>Total users</p>
        </div>
        <div className={styles.metric}>
          <p className={styles.metricVal}>{recentInvites}</p>
          <p className={styles.metricLabel}>Invites (30d)</p>
        </div>
        <div className={`${styles.metric} ${openTickets > 0 ? styles.metricAlert : ""}`}>
          <p className={styles.metricVal}>{openTickets}</p>
          <p className={styles.metricLabel}>Open tickets</p>
        </div>
      </div>

      {/* Orgs table */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Organizations</h2>
        {orgs.length === 0 ? (
          <p className={styles.empty}>No organizations yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Events</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id}>
                    <td className={styles.nameCell}>{org.name}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`plan_${org.plan}`]}`}>
                        {org.plan}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${org.status}`]}`}>
                        {org.status}
                      </span>
                    </td>
                    <td className={styles.numCell}>{org._count.users}</td>
                    <td className={styles.numCell}>{org._count.events}</td>
                    <td className={styles.dimCell}>
                      {new Date(org.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <Link href={`/superadmin/orgs/${org.id}`} className={styles.viewLink}>
                        View →
                      </Link>
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
