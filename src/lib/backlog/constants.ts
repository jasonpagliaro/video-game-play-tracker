export const GAME_STATUSES = [
  "not_started",
  "installed",
  "in_progress",
  "completed",
  "done_for_now",
  "dnf",
  "parked",
  "wont_complete",
] as const;

export const BACKLOG_SLOTS = [
  "short",
  "narrative",
  "horror",
  "action",
  "puzzle",
  "rpg_long",
  "strategy",
  "coop",
  "experimental",
  "parking_lot",
] as const;

export const COMPLETION_TYPES = [
  "completable",
  "endless",
  "sandbox",
  "multiplayer",
  "live_service",
  "roguelike",
  "unknown",
] as const;

export const PERSONAL_INTERESTS = ["high", "medium", "low", "unknown"] as const;

export const SYNC_STATES = [
  "imported",
  "synced",
  "missing_from_latest_sync",
  "manually_added",
  "ignored",
] as const;

export const SYNC_TYPES = ["library", "playtime", "achievements", "full"] as const;
export const SYNC_STATUSES = ["success", "partial", "failed"] as const;
export const CHECKIN_DECISIONS = ["continue", "pause", "park", "dnf", "complete"] as const;
export const MILESTONE_TYPES = [
  "time_played",
  "percent_complete",
  "chapter",
  "manual",
  "achievement_based",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];
export type BacklogSlot = (typeof BACKLOG_SLOTS)[number];
export type CompletionType = (typeof COMPLETION_TYPES)[number];
export type PersonalInterest = (typeof PERSONAL_INTERESTS)[number];
export type SyncState = (typeof SYNC_STATES)[number];

export const STATUS_LABELS: Record<GameStatus, string> = {
  not_started: "Not Started",
  installed: "Installed",
  in_progress: "In Progress",
  completed: "Completed",
  done_for_now: "Done for Now",
  dnf: "DNF",
  parked: "Parked",
  wont_complete: "Won't Complete",
};

export const SLOT_LABELS: Record<BacklogSlot, string> = {
  short: "Short / Palate Cleanser",
  narrative: "Narrative / Story",
  horror: "Horror",
  action: "Action / Immersive / Combat",
  puzzle: "Puzzle / Thinky",
  rpg_long: "RPG / Long",
  strategy: "Strategy / Builder",
  coop: "Co-op / Multiplayer",
  experimental: "Needs Review",
  parking_lot: "Ongoing / Open-Ended",
};

export const COMPLETION_TYPE_LABELS: Record<CompletionType, string> = {
  completable: "Completable",
  endless: "Endless",
  sandbox: "Sandbox",
  multiplayer: "Multiplayer",
  live_service: "Live Service",
  roguelike: "Roguelike",
  unknown: "Needs Type",
};

export const INTEREST_LABELS: Record<PersonalInterest, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
  unknown: "Unknown",
};

export const SYNC_STATE_LABELS: Record<SyncState, string> = {
  imported: "Imported",
  synced: "Synced",
  missing_from_latest_sync: "Missing From Latest Sync",
  manually_added: "Manually Added",
  ignored: "Ignored",
};

export const OPEN_ENDED_COMPLETION_TYPES: CompletionType[] = [
  "endless",
  "sandbox",
  "multiplayer",
  "live_service",
  "roguelike",
];

export const PARKING_COMPLETION_TYPES = OPEN_ENDED_COMPLETION_TYPES;

export const DEFAULT_ACTIVE_ROTATION_COUNT = 5;
export const DEFAULT_CHECKIN_INTERVAL_DAYS = 7;
export const DEFAULT_QUEUE_WINDOW_SIZE = 5;

export const DEFAULT_SLOT_WEIGHTS: Record<BacklogSlot, number> = {
  short: 1,
  narrative: 1,
  horror: 0.75,
  action: 1,
  puzzle: 0.8,
  rpg_long: 0.8,
  strategy: 0.75,
  coop: 0.5,
  experimental: 0.5,
  parking_lot: 0,
};
