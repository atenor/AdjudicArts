import Link from "next/link";
import { getServerSession } from "next-auth";
import { Cormorant_Garamond } from "next/font/google";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import SignOutButton from "@/components/shared/sign-out-button";
import styles from "./nav-header.module.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "700"],
  style: ["normal", "italic"],
});

export default async function NavHeader() {
  const session = await getServerSession(authOptions);
  const role = session?.user.role;
  const isJudge = role === "CHAPTER_JUDGE" || role === "NATIONAL_JUDGE";
  const canViewDashboard = Boolean(session?.user);
  const canViewEvents =
    role === "ADMIN" ||
    role === "NATIONAL_CHAIR";
  const canViewApplications =
    role === "ADMIN" ||
    role === "NATIONAL_CHAIR" ||
    role === "CHAPTER_CHAIR" ||
    role === "CHAPTER_JUDGE" ||
    role === "NATIONAL_JUDGE";
  const canImportApplications = role === "ADMIN";
  const canViewScoring = isJudge;
  const canViewNotifications = Boolean(session?.user);
  const canViewSettings = Boolean(session?.user);
  const easyNavLinks: Array<{ href: string; label: string }> = [];
  if (canViewDashboard) easyNavLinks.push({ href: "/dashboard", label: "Dashboard Home" });
  if (canViewApplications) easyNavLinks.push({ href: "/dashboard/applications", label: "Applications" });
  if (canViewScoring) easyNavLinks.push({ href: "/dashboard/scoring", label: "Judging List" });
  if (canViewEvents) easyNavLinks.push({ href: "/dashboard/events", label: "Events" });
  if (canImportApplications) easyNavLinks.push({ href: "/dashboard/import", label: "Import CSV" });
  if (canViewNotifications) easyNavLinks.push({ href: "/dashboard/notifications", label: "Notifications" });

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/dashboard" className={`${styles.wordmark} ${cormorant.className}`}>
            <span className={styles.wordmarkStrong}>Adjudic</span>
            <span className={styles.wordmarkLight}>arts</span>
          </Link>
          {canViewDashboard && (
            <Link href="/dashboard" className={styles.link}>
              Dashboard Home
            </Link>
          )}
          {canViewEvents && (
            <Link href="/dashboard/events" className={styles.link}>
              Events
            </Link>
          )}
          {canViewApplications && (
            <Link href="/dashboard/applications" className={styles.link}>
              Applications
            </Link>
          )}
          {canImportApplications && (
            <Link href="/dashboard/import" className={styles.link}>
              Import Applications
            </Link>
          )}
          {canViewScoring && (
            <Link href="/dashboard/scoring" className={styles.link}>
              Judging List
            </Link>
          )}
          {canViewNotifications && (
            <Link href="/dashboard/notifications" className={styles.link}>
              Notifications
            </Link>
          )}
        </div>
        {session?.user && (
          <div className={styles.right}>
            {canViewSettings ? (
              <Link
                href="/dashboard/notifications"
                className={styles.settingsGear}
                aria-label="Open notification settings"
                title="Settings"
              >
                ⚙
              </Link>
            ) : null}
            <span className={styles.userName}>{session.user.name}</span>
            <span className={styles.roleBadge}>{ROLE_LABELS[role as Role]}</span>
            <SignOutButton className={styles.signOut} />
          </div>
        )}
      </div>
      {easyNavLinks.length > 0 ? (
        <div className={styles.quickNav}>
          <nav className={styles.quickNavInner} aria-label="Primary dashboard navigation">
            {easyNavLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.quickNavLink}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
