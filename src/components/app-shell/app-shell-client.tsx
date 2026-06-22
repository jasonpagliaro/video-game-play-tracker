"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  Archive,
  CheckCircle2,
  CircleSlash,
  Gauge,
  ListOrdered,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ParkingCircle,
  RotateCw,
  Settings,
  TableProperties,
  Upload,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth-actions";

const SIDEBAR_STATE_KEY = "steam-backlog-sidebar-collapsed";
const SIDEBAR_STATE_EVENT = "steam-backlog-sidebar-state";

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

export function AppShellClient({
  children,
  databaseConfigured,
  showSignOut,
  userEmail,
}: {
  children: React.ReactNode;
  databaseConfigured: boolean;
  showSignOut: boolean;
  userEmail: string | null;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeSidebarState, readSidebarState, getSidebarServerState) === "true";

  function toggleCollapsed() {
    window.localStorage.setItem(SIDEBAR_STATE_KEY, String(!collapsed));
    window.dispatchEvent(new Event(SIDEBAR_STATE_EVENT));
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <aside
          className={cn(
            "hidden shrink-0 border-r border-border/70 bg-card/50 transition-[width] duration-200 lg:block",
            collapsed ? "w-16" : "w-64",
          )}
        >
          <div className="flex h-full flex-col">
            <div className={cn("flex items-center gap-2 px-3 py-4", collapsed ? "justify-center" : "justify-between")}>
              <Link
                href="/"
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  collapsed && "justify-center",
                )}
                aria-label="Steam Backlog dashboard"
              >
                <Archive className="h-5 w-5 shrink-0 text-primary" />
                {!collapsed ? (
                  <span className="min-w-0">
                    <span className="block truncate">Steam Backlog</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">Execution tracker</span>
                  </span>
                ) : null}
              </Link>
              {!collapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
                  onClick={toggleCollapsed}
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {collapsed ? (
              <div className="px-2 pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="w-full"
                      onClick={toggleCollapsed}
                      aria-label="Expand sidebar"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Expand sidebar</TooltipContent>
                </Tooltip>
              </div>
            ) : null}
            <nav className={cn("grid gap-1 px-2", collapsed && "justify-items-center")}>
              {navItems.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  item={item}
                  active={isActiveRoute(pathname, item.href)}
                  collapsed={collapsed}
                />
              ))}
            </nav>
            <div className="mt-auto p-3">
              <Separator className="mb-3" />
              {!collapsed ? (
                <div className="mb-3 truncate text-xs text-muted-foreground">{userEmail ?? "Signed in"}</div>
              ) : null}
              {showSignOut ? (
                <form action={signOutAction}>
                  <Button type="submit" variant="outline" size={collapsed ? "icon-sm" : "sm"} className="w-full">
                    {collapsed ? <span className="text-xs">Out</span> : "Sign out"}
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <MobileTopBar pathname={pathname} showSignOut={showSignOut} userEmail={userEmail} />
          {!databaseConfigured ? (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-100">
              Database is not configured. Add Supabase values and `DATABASE_URL` to `.env.local`, then run the migration.
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}

function SidebarNavItem({
  item,
  active,
  collapsed,
}: {
  item: (typeof navItems)[number];
  active: boolean;
  collapsed: boolean;
}) {
  const content = (
    <Button
      asChild
      variant={active ? "secondary" : "ghost"}
      size={collapsed ? "icon" : "default"}
      className={cn("w-full", collapsed ? "px-0" : "justify-start gap-2")}
    >
      <Link href={item.href} aria-current={active ? "page" : undefined}>
        <item.icon className="h-4 w-4" />
        {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
      </Link>
    </Button>
  );

  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function MobileTopBar({
  pathname,
  showSignOut,
  userEmail,
}: {
  pathname: string;
  showSignOut: boolean;
  userEmail: string | null;
}) {
  return (
    <div className="border-b border-border/70 bg-card/40 px-3 py-2 lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon-sm" aria-label="Open navigation">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 p-0" showCloseButton>
            <SheetHeader className="border-b border-border/70">
              <SheetTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-primary" />
                Steam Backlog
              </SheetTitle>
              <SheetDescription>Execution tracker</SheetDescription>
            </SheetHeader>
            <nav className="grid gap-1 p-2">
              {navItems.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        buttonVariants({ variant: active ? "secondary" : "ghost" }),
                        "justify-start gap-2",
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </SheetClose>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border/70 p-3">
              <div className="mb-3 truncate text-xs text-muted-foreground">{userEmail ?? "Signed in"}</div>
              {showSignOut ? (
                <form action={signOutAction}>
                  <Button type="submit" variant="outline" size="sm" className="w-full">
                    Sign out
                  </Button>
                </form>
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
        <Link href="/" className="min-w-0 truncate font-semibold">
          Steam Backlog
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/import">Import</Link>
        </Button>
      </div>
    </div>
  );
}

function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subscribeSidebarState(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SIDEBAR_STATE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SIDEBAR_STATE_EVENT, onChange);
  };
}

function readSidebarState() {
  return window.localStorage.getItem(SIDEBAR_STATE_KEY) === "true" ? "true" : "false";
}

function getSidebarServerState() {
  return "false";
}
