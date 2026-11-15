import Link from "next/link";
import { Suspense } from "react";

import { Brand } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";
import { NAV_ITEMS } from "@/lib/navigation";

/** Minimal signed-in shell. The full navigation and responsive layout arrive in Step 3. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-4 py-3 sm:px-6">
          <Link href="/today">
            <Brand />
          </Link>
          <nav className="text-muted-foreground flex flex-1 gap-4 overflow-x-auto text-sm">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-foreground whitespace-nowrap"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 sm:px-6">
        {children}
      </main>
    </div>
  );
}
