import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { signInWithEmailAction } from "@/server/actions/auth-actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const { sent } = await searchParams;
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Steam Backlog Tracker</CardTitle>
          <CardDescription>Sign in with your allowlisted email to manage the personal backlog.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isSupabaseConfigured() ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Supabase is not configured locally. Development mode will use a local placeholder user.
            </div>
          ) : sent ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Check your email for the sign-in link.
            </div>
          ) : (
            <form action={signInWithEmailAction} className="grid gap-4">
              <input type="hidden" name="origin" value={origin} />
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <Button type="submit">Send magic link</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

