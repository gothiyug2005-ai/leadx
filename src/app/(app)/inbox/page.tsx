import type { Metadata } from "next";
import { Inbox } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <PlaceholderPage
      icon={Inbox}
      title="Inbox"
      description="Conversations with the people you have contacted, synced from Gmail."
      arrivesIn="Step 10"
    />
  );
}
