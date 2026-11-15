"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActivePath, type NavCounts } from "@/lib/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ counts = {} }: { counts?: NavCounts }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        const count = item.badge ? counts[item.badge] : undefined;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active && "bg-accent text-accent-foreground font-medium",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {count ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold">
                {count > 99 ? "99+" : count}
                <span className="sr-only"> need attention</span>
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
