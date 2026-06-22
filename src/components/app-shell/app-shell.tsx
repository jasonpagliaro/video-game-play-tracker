import { AppShellClient } from "@/components/app-shell/app-shell-client";
import type { AppUser } from "@/lib/db/client";
import { isDatabaseConfigured, isSupabaseConfigured } from "@/lib/env";

export function AppShell({ children, user }: { children: React.ReactNode; user: AppUser }) {
  return (
    <AppShellClient
      databaseConfigured={isDatabaseConfigured()}
      showSignOut={isSupabaseConfigured()}
      userEmail={user.email}
    >
      {children}
    </AppShellClient>
  );
}
