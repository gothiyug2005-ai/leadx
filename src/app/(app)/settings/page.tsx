import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PlaceholderPage
      icon={Settings}
      title="Settings"
      description="Your profile, writing tone, Gmail connection, and sending limits."
      arrivesIn="Step 4"
    />
  );
}
