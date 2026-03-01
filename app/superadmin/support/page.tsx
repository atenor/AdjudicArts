import Link from "next/link";
import { prisma } from "@/lib/prisma";
import styles from "./support.module.css";

export default async function SASupport() {
  const tickets = await prisma.supportTicket.findMany({
    select: {
      id: true,
      subject: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      organization: { select: { name: true } },
      submittedBy: { select: { name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const open = tickets.filter((t) => t.status !== "resolved");
  const resolved = tickets.filter((t) => t.status === "resolved");

  const STATUS_LABEL: Record<string, string> = {
    open: "Open",
    in_progress: "In progress",
    resolved: "Resolved",
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1 className={styles.heading}>Support tickets</h1>
        <p className={styles.sub}>{open.length} open, {resolved.length} resolved</p>
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Open tickets</h2>
        {open.length === 0 ? (
          <p className={styles.empty}>No open tickets.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Subject</th><th>Organization</th><th>Submitted by</th><th>Status</th><th>Messages</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {open.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.subjectCell}>{t.subject}</td>
                    <td className={styles.dimCell}>{t.organization.name}</td>
                    <td className={styles.dimCell}>{t.submittedBy.name}</td>
                    <td>
                      <span className={`${styles.badge} ${styles[`status_${t.status}`]}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className={styles.numCell}>{t._count.messages}</td>
                    <td className={styles.dimCell}>
                      {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td>
                      <Link href={`/superadmin/support/${t.id}`} className={styles.viewLink}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {resolved.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Resolved</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr><th>Subject</th><th>Organization</th><th>Date</th><th></th></tr>
              </thead>
              <tbody>
                {resolved.map((t) => (
                  <tr key={t.id}>
                    <td className={styles.dimCell}>{t.subject}</td>
                    <td className={styles.dimCell}>{t.organization.name}</td>
                    <td className={styles.dimCell}>
                      {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td>
                      <Link href={`/superadmin/support/${t.id}`} className={styles.viewLink}>
                        View →
                      </Link>
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
