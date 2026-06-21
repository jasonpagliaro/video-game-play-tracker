import Link from "next/link";

import { CompletionTypeBadge, SlotBadge, StatusBadge, SyncStateBadge } from "@/components/badges/game-badges";
import { PageHeader } from "@/components/backlog/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BACKLOG_SLOTS,
  COMPLETION_TYPES,
  GAME_STATUSES,
  INTEREST_LABELS,
  PERSONAL_INTERESTS,
  SLOT_LABELS,
  STATUS_LABELS,
  COMPLETION_TYPE_LABELS,
} from "@/lib/backlog/constants";
import { formatDate, formatMinutes, formatPercent } from "@/lib/backlog/format";
import { requireUser } from "@/lib/auth";
import { getGame } from "@/lib/db/repository";
import { updateGameFieldsAction, updateGameStatusAction } from "@/server/actions/game-actions";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const game = await getGame(user, id);
  if (!game) {
    return (
      <div className="grid gap-4 p-4 lg:p-6">
        <PageHeader title="Game not found" />
        <Button asChild variant="outline">
          <Link href="/backlog">Back to backlog</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title={game.title} description={game.steamAppId ? `Steam App ${game.steamAppId}` : "Manual or unmatched game"} />
      <div className="flex flex-wrap gap-2">
        <StatusBadge status={game.status} />
        <SlotBadge slot={game.backlogSlot} />
        <CompletionTypeBadge completionType={game.completionType} />
        <SyncStateBadge syncState={game.syncState} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions and classification</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={updateGameStatusAction} className="grid gap-3 md:grid-cols-[minmax(0,240px)_1fr_auto] md:items-end">
              <input type="hidden" name="gameId" value={game.id} />
              <div className="grid gap-2">
                <Label htmlFor="game-status">Status</Label>
                <Select name="status" defaultValue={game.status}>
                  <SelectTrigger id="game-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dnf-reason">DNF reason</Label>
                <Input
                  id="dnf-reason"
                  name="dnfReason"
                  defaultValue={game.dnfReason ?? ""}
                  placeholder="Only needed when marking DNF"
                />
              </div>
              <Button className="md:self-end">Update status</Button>
            </form>
            <form action={updateGameFieldsAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="gameId" value={game.id} />
              <div className="grid gap-2">
                <Label htmlFor="backlog-slot">Backlog category</Label>
                <Select name="backlogSlot" defaultValue={game.backlogSlot}>
                  <SelectTrigger id="backlog-slot" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKLOG_SLOTS.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {SLOT_LABELS[slot]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="completion-type">Finish style</Label>
                <Select name="completionType" defaultValue={game.completionType}>
                  <SelectTrigger id="completion-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLETION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {COMPLETION_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personal-interest">Personal interest</Label>
                <Select name="personalInterest" defaultValue={game.personalInterest}>
                  <SelectTrigger id="personal-interest" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAL_INTERESTS.map((interest) => (
                      <SelectItem key={interest} value={interest}>
                        {INTEREST_LABELS[interest]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="queue-rank">Queue rank</Label>
                <Input id="queue-rank" name="queueRank" defaultValue={game.queueRank ?? ""} placeholder="Lower numbers show sooner" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="game-notes">Notes</Label>
                <Textarea id="game-notes" name="notes" defaultValue={game.notes ?? ""} placeholder="Planning notes, caveats, or context" />
              </div>
              <Button className="md:col-span-2">Save fields</Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Steam and progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Detail label="Playtime" value={formatMinutes(game.playtimeMinutes)} />
            <Detail label="Achievements" value={formatPercent(game.achievementPercent)} />
            <Detail label="Estimated hours" value={game.estimatedHours ? `${game.estimatedHours}h` : "-"} />
            <Detail label="Last played" value={formatDate(game.lastPlayed)} />
            <Detail label="Last synced" value={formatDate(game.lastSyncedAt)} />
            <Detail label="Review score" value={game.steamReviewScore?.toString() ?? "-"} />
            <Detail label="Release year" value={game.releaseYear?.toString() ?? "-"} />
            <Detail label="Installed" value={game.installed ? "Yes" : "No"} />
            <Detail label="Current rotation" value={game.currentRotation ? "Yes" : "No"} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-mono text-xs">{value}</span>
    </div>
  );
}
