"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Check, MoreHorizontal, RotateCw } from "lucide-react";

import {
  CompletionTypeBadge,
  InterestBadge,
  SlotBadge,
  StatusBadge,
  SyncStateBadge,
} from "@/components/badges/game-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BACKLOG_SLOTS,
  COMPLETION_TYPES,
  GAME_STATUSES,
  INTEREST_LABELS,
  PERSONAL_INTERESTS,
  SLOT_LABELS,
  STATUS_LABELS,
  COMPLETION_TYPE_LABELS,
  type GameStatus,
} from "@/lib/backlog/constants";
import { formatDate, formatMinutes, formatPercent } from "@/lib/backlog/format";
import type { AppSettings, GameSummary } from "@/lib/backlog/types";
import {
  moveQueueItemAction,
  rebalanceQueueAction,
  toggleCurrentRotationAction,
  toggleInstalledAction,
  bulkUpdateGamesAction,
  updateGameFieldsAction,
  updateGameStatusAction,
} from "@/server/actions/game-actions";

type ReplacementIntent =
  | { kind: "rotation"; game: GameSummary }
  | { kind: "status"; game: GameSummary; status: GameStatus }
  | null;

export function GameTable({
  games,
  settings,
  view = "all",
  showQueueControls = false,
}: {
  games: GameSummary[];
  settings: AppSettings;
  view?: "all" | "queue" | "rotation" | "completed" | "dnf" | "ongoing";
  showQueueControls?: boolean;
}) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [replacementIntent, setReplacementIntent] = useState<ReplacementIntent>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const activeGames = games.filter((game) => game.currentRotation);
  const activeFull = activeGames.length >= settings.maxActiveRotationCount;

  const filteredData = useMemo(
    () =>
      games.filter((game) => {
        if (statusFilter !== "all" && game.status !== statusFilter) return false;
        if (slotFilter !== "all" && game.backlogSlot !== slotFilter) return false;
        if (typeFilter !== "all" && game.completionType !== typeFilter) return false;
        return true;
      }),
    [games, slotFilter, statusFilter, typeFilter],
  );

  const columns = useMemo<ColumnDef<GameSummary>[]>(
    () => [
      {
        id: "select",
        header: "",
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.includes(row.original.id)}
            onCheckedChange={(checked) =>
              setSelectedIds((current) =>
                checked ? [...new Set([...current, row.original.id])] : current.filter((id) => id !== row.original.id),
              )
            }
            aria-label={`Select ${row.original.title}`}
          />
        ),
      },
      {
        accessorKey: "title",
        header: "Title",
        cell: ({ row }) => (
          <div className="min-w-56">
            <Link href={`/games/${row.original.id}`} className="font-medium hover:underline">
              {row.original.title}
            </Link>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {row.original.steamAppId ? <span>App {row.original.steamAppId}</span> : <span>No app id</span>}
              {row.original.notes ? <span className="max-w-48 truncate">- {row.original.notes}</span> : null}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <form action={updateGameStatusAction} className="flex min-w-44 items-center gap-2">
            <input type="hidden" name="gameId" value={row.original.id} />
            <Select name="status" defaultValue={row.original.status}>
              <SelectTrigger className="h-8 w-36">
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
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Save status">
              <Check className="h-4 w-4" />
            </Button>
          </form>
        ),
      },
      {
        id: "badges",
        header: "State",
        cell: ({ row }) => (
          <div className="flex min-w-64 flex-wrap gap-1">
            <StatusBadge status={row.original.status} />
            <SlotBadge slot={row.original.backlogSlot} />
            <CompletionTypeBadge completionType={row.original.completionType} />
          </div>
        ),
      },
      {
        id: "flags",
        header: "Install / Active",
        cell: ({ row }) => (
          <div className="flex min-w-36 gap-2">
            <form action={toggleInstalledAction}>
              <input type="hidden" name="gameId" value={row.original.id} />
              <input type="hidden" name="installed" value={String(!row.original.installed)} />
              <Button size="sm" variant={row.original.installed ? "default" : "outline"} className="h-8">
                Installed
              </Button>
            </form>
            {row.original.currentRotation || !activeFull ? (
              <form action={toggleCurrentRotationAction}>
                <input type="hidden" name="gameId" value={row.original.id} />
                <input type="hidden" name="currentRotation" value={String(!row.original.currentRotation)} />
                <Button size="sm" variant={row.original.currentRotation ? "default" : "outline"} className="h-8">
                  Active
                </Button>
              </form>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setReplacementIntent({ kind: "rotation", game: row.original })}
              >
                Active
              </Button>
            )}
          </div>
        ),
      },
      {
        accessorKey: "queueRank",
        header: "Queue",
        cell: ({ row }) => (
          <form action={updateGameFieldsAction} className="flex min-w-32 items-center gap-1">
            <input type="hidden" name="gameId" value={row.original.id} />
            <Input
              name="queueRank"
              defaultValue={row.original.queueRank ?? ""}
              className="h-8 w-20 font-mono text-xs"
              inputMode="numeric"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8" title="Save queue rank">
              <Check className="h-4 w-4" />
            </Button>
          </form>
        ),
      },
      {
        id: "metrics",
        header: "Progress",
        cell: ({ row }) => (
          <div className="min-w-36 text-xs">
            <div>{formatMinutes(row.original.playtimeMinutes)}</div>
            <div className="text-muted-foreground">Ach {formatPercent(row.original.achievementPercent)}</div>
            <div className="text-muted-foreground">Est {row.original.estimatedHours ?? "-"}h</div>
          </div>
        ),
      },
      {
        id: "review",
        header: "Review",
        cell: ({ row }) => (
          <div className="min-w-36 text-xs">
            <InterestBadge interest={row.original.personalInterest} />
            <div className="mt-1 text-muted-foreground">Steam {row.original.steamReviewScore ?? "-"}</div>
            <div className="text-muted-foreground">{formatDate(row.original.lastPlayed)}</div>
          </div>
        ),
      },
      {
        accessorKey: "syncState",
        header: "Sync",
        cell: ({ row }) => (
          <div className="min-w-32">
            <SyncStateBadge syncState={row.original.syncState} />
            <div className="mt-1 text-xs text-muted-foreground">{formatDate(row.original.lastSyncedAt)}</div>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/games/${row.original.id}`}>Open detail</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReplacementIntent({ kind: "status", game: row.original, status: "in_progress" })}>
                Start with replacement
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setReplacementIntent({ kind: "status", game: row.original, status: "dnf" })}>
                DNF with reason
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [activeFull, selectedIds],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="grid gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            placeholder="Search titles"
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            className="h-9 max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {GAME_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={slotFilter} onValueChange={setSlotFilter}>
            <SelectTrigger className="h-9 w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {BACKLOG_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {SLOT_LABELS[slot]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Finish style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All finish styles</SelectItem>
              {COMPLETION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {COMPLETION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showQueueControls ? (
          <form action={rebalanceQueueAction}>
            <Button size="sm" variant="outline" className="gap-2">
              <RotateCw className="h-4 w-4" />
              Rebalance queue
            </Button>
          </form>
        ) : null}
      </div>

      {selectedIds.length > 0 ? (
        <form action={bulkUpdateGamesAction} className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[160px_160px_190px_170px_170px_auto] md:items-end">
          {selectedIds.map((id) => (
            <input key={id} type="hidden" name="selectedIds" value={id} />
          ))}
          <Select name="bulkAction" defaultValue="set_status">
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set_status">Set status</SelectItem>
              <SelectItem value="set_slot">Set category</SelectItem>
              <SelectItem value="set_completion_type">Set finish style</SelectItem>
              <SelectItem value="set_interest">Set interest</SelectItem>
              <SelectItem value="park">Park selected</SelectItem>
              <SelectItem value="wont_complete">Won&apos;t Complete</SelectItem>
              <SelectItem value="add_to_queue">Add to queue</SelectItem>
              <SelectItem value="remove_rotation">Remove active</SelectItem>
              <SelectItem value="mark_ignored">Mark ignored</SelectItem>
              <SelectItem value="recalculate_priority">Recalc priority</SelectItem>
              <SelectItem value="reclassify">Reclassify selected</SelectItem>
              <SelectItem value="rebalance_selected">Rebalance selected</SelectItem>
            </SelectContent>
          </Select>
          <Select name="statusValue" defaultValue="not_started">
            <SelectTrigger className="h-9">
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
          <Select name="slotValue" defaultValue="short">
            <SelectTrigger className="h-9">
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
          <Select name="typeValue" defaultValue="completable">
            <SelectTrigger className="h-9">
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
          <Select name="interestValue" defaultValue="unknown">
            <SelectTrigger className="h-9">
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
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Apply to {selectedIds.length}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="h-10 whitespace-nowrap text-xs">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                  {view === "queue" ? <TableHead className="h-10 text-xs">Move</TableHead> : null}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-2 align-top text-xs">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                    {view === "queue" ? (
                      <TableCell className="py-2 align-top">
                        <div className="flex gap-1">
                          <form action={moveQueueItemAction}>
                            <input type="hidden" name="gameId" value={row.original.id} />
                            <input type="hidden" name="direction" value="up" />
                            <input type="hidden" name="currentRank" value={row.original.queueRank ?? 1000} />
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                          </form>
                          <form action={moveQueueItemAction}>
                            <input type="hidden" name="gameId" value={row.original.id} />
                            <input type="hidden" name="direction" value="down" />
                            <input type="hidden" name="currentRank" value={row.original.queueRank ?? 1000} />
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length + 1} className="h-28 text-center text-muted-foreground">
                    No games match this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ReplacementDialog
        intent={replacementIntent}
        activeGames={activeGames}
        onOpenChange={(open) => {
          if (!open) setReplacementIntent(null);
        }}
      />
    </div>
  );
}

function ReplacementDialog({
  intent,
  activeGames,
  onOpenChange,
}: {
  intent: ReplacementIntent;
  activeGames: GameSummary[];
  onOpenChange: (open: boolean) => void;
}) {
  const [replacementId, setReplacementId] = useState(activeGames[0]?.id ?? "");
  const [dnfReason, setDnfReason] = useState("");
  const open = Boolean(intent);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a rotation replacement</DialogTitle>
          <DialogDescription>
            The active limit is full. Pick the active game that leaves rotation; nothing is removed silently.
          </DialogDescription>
        </DialogHeader>
        {intent ? (
          <form action={intent.kind === "rotation" ? toggleCurrentRotationAction : updateGameStatusAction} className="grid gap-4">
            <input type="hidden" name="gameId" value={intent.game.id} />
            <input type="hidden" name="replacementGameId" value={replacementId} />
            {intent.kind === "rotation" ? (
              <input type="hidden" name="currentRotation" value="true" />
            ) : (
              <input type="hidden" name="status" value={intent.status} />
            )}
            {intent.kind === "status" && intent.status === "dnf" ? (
              <Input
                name="dnfReason"
                value={dnfReason}
                onChange={(event) => setDnfReason(event.target.value)}
                placeholder="DNF reason"
              />
            ) : null}
            <Select value={replacementId} onValueChange={setReplacementId}>
              <SelectTrigger>
                <SelectValue placeholder="Active game to remove" />
              </SelectTrigger>
              <SelectContent>
                {activeGames.map((game) => (
                  <SelectItem key={game.id} value={game.id}>
                    {game.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Apply replacement</Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
