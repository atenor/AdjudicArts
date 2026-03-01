import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSATokenPayload } from "@/lib/superadmin-auth";
import Link from "next/link";
import SASignOutButton from "@/components/admin/sa-sign-out-button";
import styles from "./superadmin.module.css";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const token = cookieStore.get("sa-session")?.value;
  if (!token) redirect("/superadmin/login");

  const payload = getSATokenPayload();
  if (!payload) redirect("/superadmin/login");

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <div className={styles.brand}>
            <span className={styles.brandStrong}>AdjudicArts</span>
            <span className={styles.brandTag}>Platform Admin</span>
          </div>
          <nav className={styles.nav}>
            <Link href="/superadmin" className={styles.navLink}>
              Dashboard
            </Link>
            <Link href="/superadmin/support" className={styles.navLink}>
              Support
            </Link>
          </nav>
          <div className={styles.right}>
            <span className={styles.adminName}>{payload.name}</span>
            <SASignOutButton />
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
