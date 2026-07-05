export const ACTION_FEEDBACK_COOKIE = "vgpt_action_feedback";

export type ActionFeedbackStatus = "success" | "error";

export type ActionFeedbackPayload = {
  id: string;
  status: ActionFeedbackStatus;
  message: string;
};

export function createActionFeedback(status: ActionFeedbackStatus, message: string): ActionFeedbackPayload {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    status,
    message,
  };
}

export function serializeActionFeedback(feedback: ActionFeedbackPayload) {
  return encodeURIComponent(JSON.stringify(feedback));
}

export function parseActionFeedback(value: string | undefined): ActionFeedbackPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ActionFeedbackPayload>;
    if (
      typeof parsed.id === "string" &&
      typeof parsed.message === "string" &&
      (parsed.status === "success" || parsed.status === "error")
    ) {
      return {
        id: parsed.id,
        status: parsed.status,
        message: parsed.message,
      };
    }
  } catch {
    return null;
  }
  return null;
}
