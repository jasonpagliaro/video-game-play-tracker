"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = ComponentProps<typeof Button> & {
  pendingLabel: string;
  pendingLabelVisible?: boolean;
  pendingChildren?: ReactNode;
};

export function PendingSubmitButton({
  pendingLabel,
  pendingLabelVisible = true,
  pendingChildren,
  children,
  disabled,
  type = "submit",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type={type} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending && pendingChildren ? (
        pendingChildren
      ) : pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {pendingLabelVisible ? pendingLabel : <span className="sr-only">{pendingLabel}</span>}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
