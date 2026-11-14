import type { Metadata } from "next";
import { Sun } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <PlaceholderPage
      icon={Sun}
      title="Today"
      description="Who to contact today, follow-ups that are due, and replies waiting for you."
      arrivesIn="Step 3"
    />
  );
}
