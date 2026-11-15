import { LogOut, Settings } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/(auth)/login/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

function initials(name: string | null | undefined, email: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

/**
 * Avatar menu for the signed-in user. Renders nothing when signed out.
 * `showName` turns it into the wider sidebar version with name and email.
 */
export async function UserMenu({ showName = false }: { showName?: boolean }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await getProfile();

  const name = profile?.full_name ?? null;
  const email = profile?.email ?? user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
          showName
            ? "hover:bg-accent flex w-full min-w-0 items-center gap-2 rounded-md p-2 text-left"
            : "rounded-full",
        )}
      >
        <Avatar className="size-8">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className="text-xs">
            {initials(name, email)}
          </AvatarFallback>
        </Avatar>
        {showName ? (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">
              {name ?? "Your account"}
            </span>
            {email ? (
              <span className="text-muted-foreground truncate text-xs">
                {email}
              </span>
            ) : null}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={showName ? "start" : "end"}
        side={showName ? "top" : "bottom"}
        className="w-56"
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">
            {name ?? "Your account"}
          </span>
          {email ? (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
