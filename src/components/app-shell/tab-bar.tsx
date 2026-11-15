"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS, isActivePath, type NavCounts } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Bottom navigation for phones. */
export function TabBar({ counts = {} }: { counts?: NavCounts }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => item.inTabBar);

  return (
    <nav
      aria-label="Main"
      className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.href);
          const count = item.badge ? counts[item.badge] : undefined;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "text-muted-foreground relative flex flex-col items-center gap-1 py-2 text-[11px]",
                  active && "text-primary font-medium",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
                {count ? (
                  <span className="bg-primary text-primary-foreground absolute top-1 left-1/2 ml-2 min-w-4 rounded-full px-1 text-center text-[10px] leading-4 font-semibold">
                    {count > 9 ? "9+" : count}
                    <span className="sr-only"> need attention</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
