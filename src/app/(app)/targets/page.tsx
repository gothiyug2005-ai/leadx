import type { Metadata } from "next";
import { Building2 } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Targets" };

export default function TargetsPage() {
  return (
    <PlaceholderPage
      icon={Building2}
      title="Targets"
      description="The jobs and companies you are going after, with progress for each."
      arrivesIn="Step 5"
    />
  );
}
