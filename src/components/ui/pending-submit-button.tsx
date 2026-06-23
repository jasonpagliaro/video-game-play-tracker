"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = ComponentProps<typeof Button> & {
  pendingLabel: string;
};

export function PendingSubmitButton({
  pendingLabel,
  children,
  disabled,
  type = "submit",
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type={type} disabled={disabled || pending} aria-busy={pending || undefined} {...props}>
      {pending ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
