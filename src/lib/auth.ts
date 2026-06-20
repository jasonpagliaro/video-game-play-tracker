import { redirect } from "next/navigation";

import { getAllowedEmails, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/db/client";

const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";

export async function getCurrentUser(): Promise<AppUser | null> {
  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      return { id: DEV_USER_ID, email: "local-dev@example.com", role: "authenticated" };
    }
    return null;
  }

  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;

  const email =
    typeof data.claims.email === "string"
      ? data.claims.email
      : session.user.email ?? null;
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.length > 0 && (!email || !allowedEmails.includes(email.toLowerCase()))) {
    return null;
  }

  return {
    id: data.claims.sub,
    email,
    role: typeof data.claims.role === "string" ? data.claims.role : "authenticated",
    accessToken: session.access_token,
  };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

