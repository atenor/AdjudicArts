import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NavHeader from "@/components/shared/nav-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <NavHeader />
      <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-6">{children}</main>
    </div>
  );
}
