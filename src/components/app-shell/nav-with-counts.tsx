import { getNavCounts } from "@/lib/data/shell";

import { SidebarNav } from "./sidebar-nav";
import { TabBar } from "./tab-bar";

export async function SidebarNavWithCounts() {
  return <SidebarNav counts={await getNavCounts()} />;
}

export async function TabBarWithCounts() {
  return <TabBar counts={await getNavCounts()} />;
}
