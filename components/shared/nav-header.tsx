import Link from "next/link";
import { getServerSession } from "next-auth";
import { Cormorant_Garamond } from "next/font/google";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { ROLE_LABELS } from "@/lib/roles";
import { countUnreadInAppNotificationsForUser } from "@/lib/db/notifications";
import SignOutButton from "@/components/shared/sign-out-button";
import styles from "./nav-header.module.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "700"],
  style: ["normal", "italic"],
});

export default async function NavHeader() {
  const session = await getServerSession(authOptions);
  const unreadNotificationCount = session?.user
    ? await countUnreadInAppNotificationsForUser(
        session.user.organizationId,
        session.user.id
      )
    : 0;
  const role = session?.user.role;
  const isJudge = role === "CHAPTER_JUDGE" || role === "NATIONAL_JUDGE";
  const canViewDashboard = Boolean(session?.user);
  const canViewEvents =
    role === "ADMIN" ||
    role === "NATIONAL_CHAIR";
  const canViewApplications =
    role === "ADMIN" ||
    role === "NATIONAL_CHAIR" ||
    role === "CHAPTER_CHAIR";
  const canImportApplications = role === "ADMIN";
  const canViewScoring = isJudge;
  const canViewNotifications = Boolean(session?.user);
  const canViewSettings = Boolean(session?.user);
  const canManageUsers = role === "ADMIN";
  const canViewSupport = Boolean(session?.user);
  const navLinks: Array<{ href: string; label: string; showNotif?: boolean }> = [];
  if (canViewDashboard) navLinks.push({ href: "/dashboard", label: "Dashboard Home" });
  if (canViewEvents) navLinks.push({ href: "/dashboard/events", label: "Events" });
  if (canViewApplications) navLinks.push({ href: "/dashboard/applications", label: "Applications" });
  if (canImportApplications) navLinks.push({ href: "/dashboard/import", label: "Import Applications" });
  if (canViewScoring) navLinks.push({ href: "/dashboard/scoring", label: "Judging List" });
  if (canViewNotifications) {
    navLinks.push({ href: "/dashboard/notifications", label: "Notifications", showNotif: true });
  }
  if (canManageUsers) navLinks.push({ href: "/dashboard/users", label: "Users" });
  if (canViewSupport) navLinks.push({ href: "/dashboard/support", label: "Support" });

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/dashboard" className={`${styles.wordmark} ${cormorant.className}`}>
            <span className={styles.wordmarkStrong}>Adjudic</span>
            <span className={styles.wordmarkLight}>arts</span>
          </Link>
          <nav className={styles.desktopLinks} aria-label="Primary dashboard navigation">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.link}>
                <span>{link.label}</span>
                {link.showNotif && unreadNotificationCount > 0 ? (
                  <span className={styles.notifBadge}>
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
        {session?.user && (
          <div className={styles.right}>
            <span className={styles.userName}>{session.user.name}</span>
            <span className={styles.roleBadge}>{ROLE_LABELS[role as Role]}</span>
            <SignOutButton className={`${styles.signOut} ${styles.desktopAction}`} />
            {canViewSettings ? (
              <Link
                href="/dashboard/notifications"
                className={`${styles.settingsGear} ${styles.desktopAction}`}
                aria-label="Open notification settings"
                title="Settings"
              >
                ⚙
              </Link>
            ) : null}
            <details className={styles.mobileMenu}>
              <summary className={styles.mobileMenuButton} aria-label="Open menu">
                ☰
              </summary>
              <nav className={styles.mobileMenuPanel} aria-label="Mobile dashboard navigation">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={styles.mobileMenuLink}>
                    <span>{link.label}</span>
                    {link.showNotif && unreadNotificationCount > 0 ? (
                      <span className={styles.notifBadge}>
                        {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                      </span>
                    ) : null}
                  </Link>
                ))}
                {canViewSettings ? (
                  <Link href="/dashboard/notifications" className={styles.mobileMenuLink}>
                    <span>Settings</span>
                  </Link>
                ) : null}
                <SignOutButton className={styles.mobileMenuSignOut} />
              </nav>
            </details>
          </div>
        )}
      </div>
    </header>
  );
}
