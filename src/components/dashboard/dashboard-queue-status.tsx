import Link from "next/link";
import { AlertTriangle, ListOrdered, Rows3, SearchCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/backlog/dashboard";

export function DashboardQueueStatus({ summary }: { summary: DashboardSummary }) {
  const queueItems = [
    {
      label: "Queued",
      value: summary.queue.total.toString(),
      detail: `${summary.queue.nextWindowCount}/${summary.queue.windowSize} in focus window`,
      icon: ListOrdered,
    },
    {
      label: "Queue-ready",
      value: summary.queue.eligibleUnqueued.toString(),
      detail: "eligible and unqueued",
      icon: Rows3,
    },
    {
      label: "Review imports",
      value: summary.queue.importedReview.toString(),
      detail: "new imports without rank",
      icon: SearchCheck,
    },
    {
      label: "Queue warnings",
      value: summary.queue.warningCount.toString(),
      detail: summary.queue.warningCount === 0 ? "balanced enough" : "needs attention",
      icon: AlertTriangle,
    },
  ];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">Total queue status</CardTitle>
        <CardAction>
          <Button asChild variant="outline" size="sm">
            <Link href="/queue">Open queue</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {queueItems.map((item) => (
          <div key={item.label} className="rounded-md border border-border/70 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
              <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="mt-3 font-mono text-2xl font-semibold">{item.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
