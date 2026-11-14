import type { Metadata } from "next";
import { LogIn } from "lucide-react";

import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col">
      <PlaceholderPage
        icon={LogIn}
        title="Sign in"
        description="Sign in with Google to start reaching the right people."
        arrivesIn="Step 2"
      />
    </main>
  );
}
