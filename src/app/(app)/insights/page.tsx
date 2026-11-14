import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <PlaceholderPage
      icon={BarChart3}
      title="Insights"
      description="Reply rates, interviews, and which message angles work best."
      arrivesIn="Step 11"
    />
  );
}
