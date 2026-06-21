"use client";

import { Fragment, type ReactNode, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  ListOrdered,
  Minus,
  MoreHorizontal,
  MoveVertical,
  Plus,
  X,
} from "lucide-react";

import { AutoSaveStatus } from "@/components/autosave/auto-save-status";
import { useAutoSaveField } from "@/components/autosave/use-auto-save-field";
import {
  CompletionTypeBadge,
  InterestBadge,
  SlotBadge,
  StatusBadge,
  SyncStateBadge,
} from "@/components/badges/game-badges";
import { StatusResolutionDialog, type StatusResolutionIntent } from "@/components/backlog/status-resolution-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  gameIsVisibleInTable,
  getDefaultVisibilityScope,
  getGameDestination,
  ghostReasonForGame,
  isGameStatus,
  type GameTableFilters,
  type GameTableView,
  type GameVisibilityScope,
  type GameVisibilitySnapshot,
} from "@/lib/backlog/autosave";
import { formatDate, formatMinutes, formatPercent } from "@/lib/backlog/format";
import type { AppSettings, GameSummary } from "@/lib/backlog/types";
import {
  autoSaveGameFieldAction,
  bulkUpdateGamesAction,
  queueCommandAction,
  sortQueueAction,
} from "@/server/actions/game-actions";

type GhostEntry = {
  id: string;
  title: string;
  sourceIndex: number;
  reason: string;
  detailHref: string;
  destinationHref: string;
  destinationLabel: string;
};

type QueueMoveIntent = {
  game: GameSummary;
} | null;

const QUEUE_SORT_OPTIONS = [
  { value: "app_recommendation", label: "App recommendation" },
  { value: "highest_priority", label: "Highest priority" },
  { value: "highest_interest", label: "Highest interest" },
  { value: "shortest_estimated", label: "Shortest estimated" },
  { value: "least_recently_played", label: "Least recently played" },
  { value: "title", label: "Title A-Z" },
] as const;

export function GameTable({
  games,
  settings,
  view = "all",
  showQueueControls = false,
  visibilityScope,
}: {
  games: GameSummary[];
  settings: AppSettings;
  view?: GameTableView;
  showQueueControls?: boolean;
  visibilityScope?: GameVisibilityScope;
}) {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [resolutionIntent, setResolutionIntent] = useState<StatusResolutionIntent>(null);
  const [queueMoveIntent, setQueueMoveIntent] = useState<QueueMoveIntent>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ghosts, setGhosts] = useState<GhostEntry[]>([]);
  const activeGames = games.filter((game) => game.currentRotation);
  const activeFull = activeGames.length >= settings.maxActiveRotationCount;
  const queuedGames = useMemo(
    () =>
      games
        .filter((game) => game.queueRank != null)
        .sort((a, b) => (a.queueRank ?? Number.MAX_SAFE_INTEGER) - (b.queueRank ?? Number.MAX_SAFE_INTEGER)),
    [games],
  );
  const movableQueuedGames = useMemo(
    () => queuedGames.filter((game) => !game.queueLocked),
    [queuedGames],
  );
  const queuePositions = useMemo(
    () => new Map(queuedGames.map((game, index) => [game.id, index + 1])),
    [queuedGames],
  );
  const resolvedVisibilityScope = visibilityScope ?? getDefaultVisibilityScope(view, games);
  const filters = useMemo<GameTableFilters>(
    () => ({ statusFilter, slotFilter, typeFilter }),
    [slotFilter, statusFilter, typeFilter],
  );

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

  const handleSaved = useCallback(
    (game: Pick<GameSummary, "id" | "title">, sourceIndex: number | undefined, snapshot: GameVisibilitySnapshot) => {
      if (gameIsVisibleInTable(snapshot, resolvedVisibilityScope, filters)) {
        setGhosts((current) => current.filter((ghost) => ghost.id !== snapshot.id));
      } else {
        const destination = getGameDestination(snapshot);
        setGhosts((current) => [
          ...current.filter((ghost) => ghost.id !== snapshot.id),
          {
            id: snapshot.id,
            title: game.title,
            sourceIndex: sourceIndex ?? 0,
            reason: ghostReasonForGame(snapshot),
            detailHref: snapshot.detailHref,
            destinationHref: destination.href,
            destinationLabel: destination.label,
          },
        ]);
      }
      router.refresh();
    },
    [filters, resolvedVisibilityScope, router],
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
          <GameStatusAutoSelect
            key={`${row.original.id}-status-${row.original.status}`}
            game={row.original}
            settings={settings}
            activeFull={activeFull}
            sourceIndex={row.index}
            onResolutionNeeded={setResolutionIntent}
            onSaved={handleSaved}
          />
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
          <div className="flex min-w-44 flex-col gap-1">
            <div className="flex gap-2">
              <InstalledToggle
                key={`${row.original.id}-installed-${row.original.installed}`}
                game={row.original}
                sourceIndex={row.index}
                onSaved={handleSaved}
              />
              <RotationToggle
                key={`${row.original.id}-rotation-${row.original.currentRotation}`}
                game={row.original}
                activeFull={activeFull}
                sourceIndex={row.index}
                onResolutionNeeded={setResolutionIntent}
                onSaved={handleSaved}
              />
            </div>
          </div>
        ),
      },
      {
        accessorKey: "queueRank",
        header: "Queue",
        cell: ({ row }) => (
          <QueueStatusControl
            game={row.original}
            position={queuePositions.get(row.original.id) ?? null}
          />
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
              <DropdownMenuItem
                onClick={() =>
                  setResolutionIntent({
                    kind: "status",
                    game: row.original,
                    status: "in_progress",
                    sourceIndex: row.index,
                  })
                }
              >
                Start with replacement
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setResolutionIntent({ kind: "status", game: row.original, status: "dnf", sourceIndex: row.index })
                }
              >
                DNF with reason
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [activeFull, handleSaved, queuePositions, selectedIds, settings],
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

  const visibleRows = table.getRowModel().rows;
  const tableColSpan = columns.length + (view === "queue" ? 1 : 0);
  const ghostsForIndex = (index: number) =>
    ghosts.filter((ghost) => (index === visibleRows.length ? ghost.sourceIndex >= index : ghost.sourceIndex === index));

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
              <SelectValue placeholder="Slot" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All slots</SelectItem>
              {BACKLOG_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {SLOT_LABELS[slot]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {COMPLETION_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {COMPLETION_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {showQueueControls ? (
          <form action={sortQueueAction} className="flex flex-wrap items-center gap-2">
            <Select name="preset" defaultValue="app_recommendation">
              <SelectTrigger className="h-9 w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUEUE_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="gap-2">
              <ListOrdered className="h-4 w-4" />
              Sort queue
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
              <SelectItem value="set_slot">Set slot</SelectItem>
              <SelectItem value="set_completion_type">Set type</SelectItem>
              <SelectItem value="set_interest">Set interest</SelectItem>
              <SelectItem value="park">Park selected</SelectItem>
              <SelectItem value="wont_complete">Won&apos;t Complete</SelectItem>
              <SelectItem value="add_to_queue">Add to queue</SelectItem>
              <SelectItem value="remove_rotation">Remove active</SelectItem>
              <SelectItem value="mark_ignored">Mark ignored</SelectItem>
              <SelectItem value="recalculate_priority">Recalc priority</SelectItem>
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
              {visibleRows.length || ghosts.length ? (
                <>
                  {visibleRows.map((row, index) => (
                    <Fragment key={row.id}>
                      {ghostsForIndex(index).map((ghost) => (
                        <GhostTableRow
                          key={ghost.id}
                          ghost={ghost}
                          colSpan={tableColSpan}
                          onDismiss={() => setGhosts((current) => current.filter((entry) => entry.id !== ghost.id))}
                        />
                      ))}
                      <TableRow>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-2 align-top text-xs">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                        {view === "queue" ? (
                          <TableCell className="py-2 align-top">
                            <QueueMoveControls
                              game={row.original}
                              movableGames={movableQueuedGames}
                              onMovePrecise={setQueueMoveIntent}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    </Fragment>
                  ))}
                  {ghostsForIndex(visibleRows.length).map((ghost) => (
                    <GhostTableRow
                      key={ghost.id}
                      ghost={ghost}
                      colSpan={tableColSpan}
                      onDismiss={() => setGhosts((current) => current.filter((entry) => entry.id !== ghost.id))}
                    />
                  ))}
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={tableColSpan} className="h-28 text-center text-muted-foreground">
                    No games match this view.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <StatusResolutionDialog
        intent={resolutionIntent}
        activeGames={activeGames}
        onOpenChange={(open) => {
          if (!open) setResolutionIntent(null);
        }}
        onSaved={(intent, snapshot) => handleSaved(intent.game, intent.sourceIndex, snapshot)}
      />
      <QueueMoveDialog
        intent={queueMoveIntent}
        queuedGames={movableQueuedGames}
        onOpenChange={(open) => {
          if (!open) setQueueMoveIntent(null);
        }}
      />
    </div>
  );
}

function GameStatusAutoSelect({
  game,
  settings,
  activeFull,
  sourceIndex,
  onResolutionNeeded,
  onSaved,
}: {
  game: GameSummary;
  settings: AppSettings;
  activeFull: boolean;
  sourceIndex: number;
  onResolutionNeeded: (intent: StatusResolutionIntent) => void;
  onSaved: (game: Pick<GameSummary, "id" | "title">, sourceIndex: number, snapshot: GameVisibilitySnapshot) => void;
}) {
  const field = useAutoSaveField<GameStatus, GameVisibilitySnapshot>({
    initialValue: game.status,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "status", value }),
    onSaved: (snapshot) => onSaved(game, sourceIndex, snapshot),
  });

  function handleChange(value: string) {
    if (!isGameStatus(value)) return;
    if (value === "dnf") {
      onResolutionNeeded({ kind: "status", game, status: value, sourceIndex });
      return;
    }
    if (
      value === "in_progress" &&
      !game.currentRotation &&
      settings.inProgressAddsToRotationWhenSpace &&
      activeFull
    ) {
      onResolutionNeeded({ kind: "status", game, status: value, sourceIndex });
      return;
    }
    field.setAndSave(value);
  }

  return (
    <div className="grid min-w-44 gap-1">
      <Select value={field.value} onValueChange={handleChange}>
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
      <AutoSaveStatus status={field.status} message={field.message} />
    </div>
  );
}

function QueueStatusControl({ game, position }: { game: GameSummary; position: number | null }) {
  if (game.queueRank == null) {
    const eligible = canAddToQueue(game);
    return (
      <form action={queueCommandAction} className="min-w-32">
        <input type="hidden" name="gameId" value={game.id} />
        <input type="hidden" name="command" value="add_to_queue" />
        <Button type="submit" size="sm" variant="outline" className="h-8 gap-1" disabled={!eligible}>
          <Plus className="h-3.5 w-3.5" />
          Queue
        </Button>
      </form>
    );
  }

  return (
    <div className="flex min-w-32 items-center gap-2">
      <span className="rounded-md border border-border px-2 py-1 font-mono text-xs">
        {position === 1 ? "Next" : position ? `#${position}` : "Queued"}
      </span>
      <form action={queueCommandAction}>
        <input type="hidden" name="gameId" value={game.id} />
        <input type="hidden" name="command" value="remove_from_queue" />
        <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" title="Remove from queue">
          <Minus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function QueueMoveControls({
  game,
  movableGames,
  onMovePrecise,
}: {
  game: GameSummary;
  movableGames: GameSummary[];
  onMovePrecise: (intent: QueueMoveIntent) => void;
}) {
  const movableIndex = movableGames.findIndex((item) => item.id === game.id);
  const disabled = game.queueLocked || movableIndex === -1;
  const isFirst = movableIndex <= 0;
  const isLast = movableIndex === movableGames.length - 1;

  return (
    <div className="flex gap-1">
      <QueueCommandButton
        gameId={game.id}
        command="move_to_top"
        title="Move to top"
        disabled={disabled || isFirst}
      >
        <ChevronsUp className="h-4 w-4" />
      </QueueCommandButton>
      <QueueCommandButton
        gameId={game.id}
        command="promote"
        title="Promote"
        disabled={disabled || isFirst}
      >
        <ArrowUp className="h-4 w-4" />
      </QueueCommandButton>
      <QueueCommandButton
        gameId={game.id}
        command="demote"
        title="Demote"
        disabled={disabled || isLast}
      >
        <ArrowDown className="h-4 w-4" />
      </QueueCommandButton>
      <QueueCommandButton
        gameId={game.id}
        command="move_to_bottom"
        title="Move to bottom"
        disabled={disabled || isLast}
      >
        <ChevronsDown className="h-4 w-4" />
      </QueueCommandButton>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        title="Move before or after"
        disabled={disabled || movableGames.length < 2}
        onClick={() => onMovePrecise({ game })}
      >
        <MoveVertical className="h-4 w-4" />
      </Button>
    </div>
  );
}

function QueueCommandButton({
  gameId,
  command,
  title,
  disabled,
  children,
}: {
  gameId: string;
  command: string;
  title: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <form action={queueCommandAction}>
      <input type="hidden" name="gameId" value={gameId} />
      <input type="hidden" name="command" value={command} />
      <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" title={title} disabled={disabled}>
        {children}
      </Button>
    </form>
  );
}

function QueueMoveDialog({
  intent,
  queuedGames,
  onOpenChange,
}: {
  intent: QueueMoveIntent;
  queuedGames: GameSummary[];
  onOpenChange: (open: boolean) => void;
}) {
  const targets = useMemo(
    () => queuedGames.filter((game) => game.id !== intent?.game.id),
    [intent?.game.id, queuedGames],
  );
  const [command, setCommand] = useState<"move_before" | "move_after">("move_before");
  const [targetGameId, setTargetGameId] = useState("");
  const selectedTargetGameId = targets.some((game) => game.id === targetGameId)
    ? targetGameId
    : targets[0]?.id ?? "";

  return (
    <Dialog open={Boolean(intent)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move queued game</DialogTitle>
          <DialogDescription>
            Place {intent?.game.title ?? "this game"} before or after another queued game.
          </DialogDescription>
        </DialogHeader>
        {intent ? (
          <form action={queueCommandAction} className="grid gap-4" onSubmit={() => onOpenChange(false)}>
            <input type="hidden" name="gameId" value={intent.game.id} />
            <input type="hidden" name="command" value={command} />
            <input type="hidden" name="targetGameId" value={selectedTargetGameId} />
            <div className="grid gap-2">
              <Label htmlFor="queue-move-placement">Placement</Label>
              <Select value={command} onValueChange={(value) => setCommand(value as "move_before" | "move_after")}>
                <SelectTrigger id="queue-move-placement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="move_before">Before</SelectItem>
                  <SelectItem value="move_after">After</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="queue-move-target">Target game</Label>
              <Select value={selectedTargetGameId} onValueChange={setTargetGameId}>
                <SelectTrigger id="queue-move-target">
                  <SelectValue placeholder="Choose queued game" />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((game) => (
                    <SelectItem key={game.id} value={game.id}>
                      {game.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!selectedTargetGameId}>
                Move
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function canAddToQueue(game: GameSummary) {
  return (
    game.queueRank == null &&
    !game.currentRotation &&
    game.syncState !== "ignored" &&
    game.status !== "completed" &&
    game.status !== "done_for_now" &&
    game.status !== "dnf" &&
    game.status !== "parked" &&
    game.status !== "wont_complete"
  );
}

function InstalledToggle({
  game,
  sourceIndex,
  onSaved,
}: {
  game: GameSummary;
  sourceIndex: number;
  onSaved: (game: Pick<GameSummary, "id" | "title">, sourceIndex: number, snapshot: GameVisibilitySnapshot) => void;
}) {
  const field = useAutoSaveField<boolean, GameVisibilitySnapshot>({
    initialValue: game.installed,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "installed", value }),
    serialize: (value) => String(value),
    onSaved: (snapshot) => onSaved(game, sourceIndex, snapshot),
  });

  return (
    <div className="grid gap-1">
      <Button
        type="button"
        size="sm"
        variant={field.value ? "default" : "outline"}
        className="h-8"
        onClick={() => field.setAndSave(!field.value)}
      >
        Installed
      </Button>
      <AutoSaveStatus status={field.status} message={field.message} />
    </div>
  );
}

function RotationToggle({
  game,
  activeFull,
  sourceIndex,
  onResolutionNeeded,
  onSaved,
}: {
  game: GameSummary;
  activeFull: boolean;
  sourceIndex: number;
  onResolutionNeeded: (intent: StatusResolutionIntent) => void;
  onSaved: (game: Pick<GameSummary, "id" | "title">, sourceIndex: number, snapshot: GameVisibilitySnapshot) => void;
}) {
  const field = useAutoSaveField<boolean, GameVisibilitySnapshot>({
    initialValue: game.currentRotation,
    save: (value) => autoSaveGameFieldAction({ gameId: game.id, field: "currentRotation", value }),
    serialize: (value) => String(value),
    onSaved: (snapshot) => onSaved(game, sourceIndex, snapshot),
  });

  function handleClick() {
    if (!field.value && activeFull) {
      onResolutionNeeded({ kind: "rotation", game, sourceIndex });
      return;
    }
    field.setAndSave(!field.value);
  }

  return (
    <div className="grid gap-1">
      <Button type="button" size="sm" variant={field.value ? "default" : "outline"} className="h-8" onClick={handleClick}>
        Active
      </Button>
      <AutoSaveStatus status={field.status} message={field.message} />
    </div>
  );
}

function GhostTableRow({
  ghost,
  colSpan,
  onDismiss,
}: {
  ghost: GhostEntry;
  colSpan: number;
  onDismiss: () => void;
}) {
  return (
    <TableRow className="bg-muted/40">
      <TableCell colSpan={colSpan} className="py-3 text-xs text-muted-foreground">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-medium text-foreground">{ghost.title}</span>{" "}
            <span>{ghost.reason}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={ghost.detailHref} className="font-medium text-foreground underline-offset-4 hover:underline">
              Open detail
            </Link>
            <Link href={ghost.destinationHref} className="underline-offset-4 hover:underline">
              {ghost.destinationLabel}
            </Link>
            <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={onDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}
