import Link from "next/link";
import { signOutAction } from "@/server/actions/auth-actions";
import {
  Archive,
  CheckCircle2,
  CircleSlash,
  Gauge,
  ListOrdered,
  ParkingCircle,
  RotateCw,
  Settings,
  TableProperties,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { AppUser } from "@/lib/db/client";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/rotation", label: "Rotation", icon: RotateCw },
  { href: "/backlog", label: "Backlog", icon: TableProperties },
  { href: "/queue", label: "Next Up", icon: ListOrdered },
  { href: "/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/dnf", label: "DNF / Won't", icon: CircleSlash },
  { href: "/ongoing", label: "Ongoing", icon: ParkingCircle },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 border-r border-border/70 bg-card/50 lg:block">
        <div className="flex h-full flex-col">
          <div className="px-4 py-5">
            <div className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold">Steam Backlog</div>
                <div className="text-xs text-muted-foreground">Execution tracker</div>
              </div>
            </div>
          </div>
          <nav className="grid gap-1 px-2">
            {navItems.map((item) => (
              <Button key={item.href} asChild variant="ghost" className="justify-start gap-2">
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <div className="mt-auto p-3">
            <Separator className="mb-3" />
            <div className="mb-3 truncate text-xs text-muted-foreground">{user.email ?? "Signed in"}</div>
            {isSupabaseConfigured() ? (
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm" className="w-full">
                  Sign out
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <div className="border-b border-border/70 bg-card/40 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="font-semibold">Steam Backlog</div>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <Button key={item.href} asChild variant="secondary" size="sm" className="shrink-0">
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </div>
        </div>
        {!isDatabaseConfigured() ? (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-100">
            Database is not configured. Add Supabase values and `DATABASE_URL` to `.env.local`, then run the migration.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
