import type { Metadata } from "next";
import { KanbanSquare } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return (
    <PlaceholderPage
      icon={KanbanSquare}
      title="Pipeline"
      description="Everyone you are in touch with, from first contact to offer."
      arrivesIn="Step 11"
    />
  );
}
