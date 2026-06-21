"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";

import type { AutoSaveStatus as AutoSaveStatusValue } from "./use-auto-save-field";

export function AutoSaveStatus({
  status,
  message,
}: {
  status: AutoSaveStatusValue;
  message?: string | null;
}) {
  if (status === "idle") return null;
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Saving
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-500" aria-live="polite">
        <Check className="h-3.5 w-3.5" />
        Saved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-destructive" aria-live="polite">
      <CircleAlert className="h-3.5 w-3.5" />
      {message || "Not saved"}
    </span>
  );
}
