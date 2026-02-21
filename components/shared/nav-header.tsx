import Link from "next/link";
import { getServerSession } from "next-auth";
import { Cormorant_Garamond } from "next/font/google";
import { authOptions } from "@/lib/auth";
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
  const canViewEvents =
    session?.user.role === "ADMIN" ||
    session?.user.role === "NATIONAL_CHAIR";
  const canViewApplications =
    session?.user.role === "ADMIN" ||
    session?.user.role === "NATIONAL_CHAIR";
  const canImportApplications = session?.user.role === "ADMIN";
  const canViewScoring =
    session?.user.role === "CHAPTER_JUDGE" ||
    session?.user.role === "NATIONAL_JUDGE";

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <Link href="/dashboard" className={`${styles.wordmark} ${cormorant.className}`}>
            <span className={styles.wordmarkStrong}>Adjudic</span>
            <span className={styles.wordmarkLight}>arts</span>
          </Link>
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
              Scoring
            </Link>
          )}
        </div>
        {session?.user && (
          <div className={styles.right}>
            <span className={styles.userName}>{session.user.name}</span>
            <span className={styles.roleBadge}>{ROLE_LABELS[session.user.role]}</span>
            <SignOutButton className={styles.signOut} />
          </div>
        )}
      </div>
    </header>
  );
}
