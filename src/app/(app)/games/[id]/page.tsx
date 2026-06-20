import Link from "next/link";

import { CompletionTypeBadge, SlotBadge, StatusBadge, SyncStateBadge } from "@/components/badges/game-badges";
import { PageHeader } from "@/components/backlog/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
            <form action={updateGameStatusAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <input type="hidden" name="gameId" value={game.id} />
              <Select name="status" defaultValue={game.status}>
                <SelectTrigger>
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
              <Input name="dnfReason" defaultValue={game.dnfReason ?? ""} placeholder="DNF reason when relevant" />
              <Button>Update status</Button>
            </form>
            <form action={updateGameFieldsAction} className="grid gap-3 md:grid-cols-2">
              <input type="hidden" name="gameId" value={game.id} />
              <Select name="backlogSlot" defaultValue={game.backlogSlot}>
                <SelectTrigger>
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
              <Select name="completionType" defaultValue={game.completionType}>
                <SelectTrigger>
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
              <Select name="personalInterest" defaultValue={game.personalInterest}>
                <SelectTrigger>
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
              <Input name="queueRank" defaultValue={game.queueRank ?? ""} placeholder="Queue rank" />
              <Textarea name="notes" defaultValue={game.notes ?? ""} className="md:col-span-2" placeholder="Notes" />
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

