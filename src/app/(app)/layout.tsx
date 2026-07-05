import { cookies } from "next/headers";

import { AppShell } from "@/components/app-shell/app-shell";
import { ActionFeedbackAnnouncer } from "@/components/ui/action-feedback-announcer";
import { ACTION_FEEDBACK_COOKIE, parseActionFeedback } from "@/lib/action-feedback";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const cookieStore = await cookies();
  const feedback = parseActionFeedback(cookieStore.get(ACTION_FEEDBACK_COOKIE)?.value);

  return (
    <>
      <AppShell user={user}>{children}</AppShell>
      <ActionFeedbackAnnouncer feedback={feedback} />
    </>
  );
}
