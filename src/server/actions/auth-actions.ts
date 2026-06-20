"use server";

import { redirect } from "next/navigation";

import { getAllowedEmails, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function signInWithEmailAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const allowedEmails = getAllowedEmails();
  if (allowedEmails.length > 0 && !allowedEmails.includes(email)) {
    throw new Error("This email is not allowlisted for this personal app.");
  }
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  const origin = String(formData.get("origin") ?? "");
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) throw new Error(error.message);
  redirect("/login?sent=1");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  redirect("/login");
}

