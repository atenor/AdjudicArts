import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import MarketingHomepage from "@/components/marketing/homepage";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return <MarketingHomepage />;
}
