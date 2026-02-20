export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import MarketingHomepage from "@/components/marketing/homepage";

export const metadata: Metadata = {
  title: "AdjudicArts",
  description: "Adjudication workflow platform for scholarship competitions.",
};

export default function MarketingPage() {
  return <MarketingHomepage />;
}
