import Link from "next/link";
import { Suspense } from "react";

import {
  SidebarNavWithCounts,
  TabBarWithCounts,
} from "@/components/app-shell/nav-with-counts";
import { SendMeter } from "@/components/app-shell/send-meter";
import { SidebarNavList } from "@/components/app-shell/sidebar-nav";
import { TabBarList } from "@/components/app-shell/tab-bar";
import { Brand } from "@/components/brand";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "@/components/user-menu";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="bg-muted/30 sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r px-3 py-5 md:flex">
        <Link href="/today" className="px-3">
          <Brand />
        </Link>
        <Suspense fallback={<SidebarNavList pathname={null} />}>
          <SidebarNavWithCounts />
        </Suspense>
        <div className="mt-auto flex flex-col gap-3">
          <Suspense fallback={<Skeleton className="h-20 w-full" />}>
            <SendMeter />
          </Suspense>
          <div className="flex items-center gap-2 px-1">
            <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
              <UserMenu showName />
            </Suspense>
          </div>
        </div>
      </aside>

      {/* Phone header */}
      <header className="bg-background/95 sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 backdrop-blur md:hidden">
        <Link href="/today">
          <Brand />
        </Link>
        <Suspense fallback={<Skeleton className="size-8 rounded-full" />}>
          <UserMenu />
        </Suspense>
      </header>

      <main className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 sm:px-6 md:py-10">
          {children}
        </div>
      </main>

      <Suspense fallback={<TabBarList pathname={null} />}>
        <TabBarWithCounts />
      </Suspense>
    </div>
  );
}
