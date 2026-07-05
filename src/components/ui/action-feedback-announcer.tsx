"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import {
  ACTION_FEEDBACK_COOKIE,
  type ActionFeedbackPayload,
} from "@/lib/action-feedback";

export function ActionFeedbackAnnouncer({
  feedback,
}: {
  feedback: ActionFeedbackPayload | null;
}) {
  const feedbackId = feedback?.id;

  useEffect(() => {
    if (!feedbackId) return;
    document.cookie = `${ACTION_FEEDBACK_COOKIE}=; Max-Age=0; path=/; SameSite=Lax`;
  }, [feedbackId]);

  if (!feedback) return null;

  const Icon = feedback.status === "success" ? CheckCircle2 : XCircle;
  const tone =
    feedback.status === "success"
      ? "border-emerald-500/50 bg-emerald-500 text-emerald-950"
      : "border-destructive/60 bg-destructive text-destructive-foreground";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-lg ${tone}`}
      style={{ animation: "action-feedback-dismiss 5s ease-in forwards" }}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{feedback.message}</span>
    </div>
  );
}
