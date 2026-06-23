import { StatusBadge } from "@/components/badges/game-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/lib/backlog/constants";
import { formatDateTime } from "@/lib/backlog/format";
import type { GameStatusHistoryEntry } from "@/lib/backlog/types";

export function StatusHistoryTimeline({ history }: { history: GameStatusHistoryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status history</CardTitle>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/70 px-3 py-4 text-sm text-muted-foreground">
            No status changes recorded yet.
          </p>
        ) : (
          <ol className="grid gap-4">
            {history.map((entry, index) => (
              <li key={entry.id} className="grid grid-cols-[1rem_1fr] gap-3">
                <div className="relative flex justify-center pt-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full border border-primary/60 bg-primary/30" />
                  {index < history.length - 1 ? (
                    <span className="absolute top-5 bottom-[-1rem] w-px bg-border" />
                  ) : null}
                </div>
                <div className="grid gap-1.5 pb-1">
                  <div className="text-xs font-medium text-muted-foreground">{formatDateTime(entry.changedAt)}</div>
                  <StatusChange entry={entry} />
                  {entry.notes ? <p className="text-sm leading-relaxed text-muted-foreground">{entry.notes}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function StatusChange({ entry }: { entry: GameStatusHistoryEntry }) {
  if (!entry.previousStatus) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Set to</span>
        <StatusBadge status={entry.newStatus} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="sr-only">
        Changed from {STATUS_LABELS[entry.previousStatus]} to {STATUS_LABELS[entry.newStatus]}
      </span>
      <StatusBadge status={entry.previousStatus} />
      <span aria-hidden="true" className="text-muted-foreground">
        to
      </span>
      <StatusBadge status={entry.newStatus} />
    </div>
  );
}
