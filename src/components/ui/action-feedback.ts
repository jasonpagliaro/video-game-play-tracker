"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import type { ActionFeedbackState } from "@/server/actions/game-actions";

type FeedbackAction = (state: ActionFeedbackState, formData: FormData) => Promise<ActionFeedbackState>;
type FeedbackFormAction = (formData: FormData) => void;

const initialActionFeedbackState: ActionFeedbackState = {
  status: "idle",
  message: null,
  submittedAt: 0,
};

export function useActionFeedback(action: FeedbackAction): FeedbackFormAction {
  const [state, formAction] = useActionState(action, initialActionFeedbackState);
  const { message, status, submittedAt } = state;

  useEffect(() => {
    if (!message || status === "idle") return;
    if (status === "success") {
      toast.success(message);
    } else {
      toast.error(message);
    }
  }, [message, status, submittedAt]);

  return formAction;
}
