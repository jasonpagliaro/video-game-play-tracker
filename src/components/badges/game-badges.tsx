import { Badge } from "@/components/ui/badge";
import {
  COMPLETION_TYPE_LABELS,
  type BacklogSlot,
  type CompletionType,
  type GameStatus,
  type PersonalInterest,
  type SyncState,
  INTEREST_LABELS,
  SLOT_LABELS,
  STATUS_LABELS,
  SYNC_STATE_LABELS,
} from "@/lib/backlog/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: GameStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "whitespace-nowrap",
        status === "in_progress" && "border-emerald-500/40 text-emerald-300",
        status === "completed" && "border-sky-500/40 text-sky-300",
        status === "done_for_now" && "border-cyan-500/40 text-cyan-300",
        status === "dnf" && "border-amber-500/40 text-amber-300",
        status === "wont_complete" && "border-red-500/40 text-red-300",
        status === "parked" && "border-zinc-500/40 text-zinc-300",
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function SlotBadge({ slot }: { slot: BacklogSlot }) {
  return (
    <Badge variant="secondary" className="whitespace-nowrap font-normal">
      {SLOT_LABELS[slot]}
    </Badge>
  );
}

export function CompletionTypeBadge({ completionType }: { completionType: CompletionType }) {
  return (
    <Badge variant="outline" className="whitespace-nowrap font-normal text-muted-foreground">
      {COMPLETION_TYPE_LABELS[completionType]}
    </Badge>
  );
}

export function InterestBadge({ interest }: { interest: PersonalInterest }) {
  return (
    <Badge variant={interest === "high" ? "default" : "outline"} className="whitespace-nowrap">
      {INTEREST_LABELS[interest]}
    </Badge>
  );
}

export function SyncStateBadge({ syncState }: { syncState: SyncState }) {
  return (
    <Badge variant="outline" className="whitespace-nowrap text-muted-foreground">
      {SYNC_STATE_LABELS[syncState]}
    </Badge>
  );
}
