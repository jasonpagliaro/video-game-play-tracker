import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calculateCategoryDistribution } from "@/lib/backlog/queue";
import { COMPLETION_TYPE_LABELS, SLOT_LABELS } from "@/lib/backlog/constants";
import type { GameSummary } from "@/lib/backlog/types";

export function QueueBalancePanel({ games }: { games: GameSummary[] }) {
  const queued = games.filter((game) => game.queueRank != null);
  const distribution = calculateCategoryDistribution(queued);
  const slotEntries = Object.entries(distribution.slots).filter(([, count]) => count > 0);
  const typeEntries = Object.entries(distribution.completionTypes).filter(([, count]) => count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Category distribution</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Slots</div>
          <div className="grid gap-2">
            {slotEntries.length ? (
              slotEntries.map(([slot, count]) => (
                <BalanceRow key={slot} label={SLOT_LABELS[slot as keyof typeof SLOT_LABELS]} count={count} total={distribution.total} />
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No queued games yet.</div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Completion types</div>
          <div className="grid gap-2">
            {typeEntries.length ? (
              typeEntries.map(([type, count]) => (
                <BalanceRow
                  key={type}
                  label={COMPLETION_TYPE_LABELS[type as keyof typeof COMPLETION_TYPE_LABELS]}
                  count={count}
                  total={distribution.total}
                />
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No queued games yet.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BalanceRow({ label, count, total }: { label: string; count: number; total: number }) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[1fr_48px] items-center gap-3 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          <span className="font-mono text-xs text-muted-foreground">{percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted">
          <div className="h-1.5 rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="font-mono text-xs text-muted-foreground">{count}</div>
    </div>
  );
}

