import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getImpersonationPayload } from "@/lib/superadmin-auth";
import NavHeader from "@/components/shared/nav-header";
import ImpersonationBanner from "@/components/admin/impersonation-banner";
import styles from "./layout.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const impersonation = getImpersonationPayload();

  return (
    <div className={styles.shell}>
      {impersonation && <ImpersonationBanner orgName={impersonation.orgName} />}
      <NavHeader />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
