import { AlertTriangle, Info } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Warning } from "@/lib/backlog/types";

export function WarningPanel({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No execution warnings</AlertTitle>
        <AlertDescription>Rotation count, installed count, active variety, and queue variety are within current rules.</AlertDescription>
      </Alert>
    );
  }
  return (
    <div className="grid gap-3">
      {warnings.map((warning) => (
        <Alert key={warning.code} variant={warning.severity === "critical" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{warning.title}</AlertTitle>
          <AlertDescription>{warning.detail}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

