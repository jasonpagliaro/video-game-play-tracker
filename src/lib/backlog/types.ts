import type {
  BacklogSlot,
  CompletionType,
  GameStatus,
  PersonalInterest,
  SyncState,
} from "./constants";

export type AppSettings = {
  id?: string;
  userId?: string;
  maxActiveRotationCount: number;
  maxInstalledCount: number | null;
  checkinIntervalDays: number;
  checkinIntervalHoursPlayed: number;
  completedSetsInstalledFalse: boolean;
  dnfSetsInstalledFalse: boolean;
  parkedSetsInstalledFalse: boolean;
  inProgressSetsInstalledTrue: boolean;
  inProgressAddsToRotationWhenSpace: boolean;
  autoQueueNewImports: boolean;
  protectManualFieldsFromSync: boolean;
  queueSlidingWindowSize: number;
  rotationSkipCooldownDays: number;
  rotationSkipLimit: number;
  parkedReassessmentDays: number;
  slotWeights: Record<string, number>;
};

export type Game = {
  id: string;
  userId: string;
  steamAppId: number | null;
  steamid64Owner: string | null;
  title: string;
  normalizedTitle: string;
  source: string;
  playtimeMinutes: number;
  playtimeWindowsMinutes: number | null;
  playtimeMacMinutes: number | null;
  playtimeLinuxMinutes: number | null;
  lastPlayed: Date | null;
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
  achievementPercent: number | null;
  steamReviewScore: number | null;
  steamReviewSummary: string | null;
  releaseYear: number | null;
  genres: string[] | null;
  tags: string[] | null;
  estimatedHours: number | null;
  completionType: CompletionType;
  backlogSlot: BacklogSlot;
  priorityScore: number;
  queueRank: number | null;
  queueLocked: boolean;
  rotationSkipCount: number;
  rotationSkipUntil: Date | null;
  rotationLastSkippedAt: Date | null;
  parkedForLater: boolean;
  reassessAfter: Date | null;
  status: GameStatus;
  installed: boolean;
  currentRotation: boolean;
  dateAdded: Date | null;
  dateStarted: Date | null;
  dateCompleted: Date | null;
  dateDnf: Date | null;
  dnfReason: string | null;
  personalInterest: PersonalInterest;
  syncState: SyncState;
  firstSeenAt: Date | null;
  lastSeenInSyncAt: Date | null;
  lastSyncedAt: Date | null;
  notes: string | null;
  manualBacklogSlot: boolean;
  manualCompletionType: boolean;
  rawImportMetadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GameSummary = Pick<
  Game,
  | "id"
  | "title"
  | "steamAppId"
  | "status"
  | "installed"
  | "currentRotation"
  | "backlogSlot"
  | "completionType"
  | "priorityScore"
  | "queueRank"
  | "queueLocked"
  | "rotationSkipCount"
  | "rotationSkipUntil"
  | "rotationLastSkippedAt"
  | "parkedForLater"
  | "reassessAfter"
  | "personalInterest"
  | "playtimeMinutes"
  | "achievementPercent"
  | "estimatedHours"
  | "steamReviewScore"
  | "steamReviewSummary"
  | "releaseYear"
  | "lastPlayed"
  | "dateAdded"
  | "lastSyncedAt"
  | "syncState"
  | "steamid64Owner"
  | "notes"
  | "dnfReason"
>;

export type CsvMapping = Record<string, string | null>;

export type CsvPreviewRow = {
  rowNumber: number;
  valid: boolean;
  reason?: string;
  raw: Record<string, string>;
  normalized?: ParsedCsvGame;
};

export type ParsedCsvGame = {
  title: string;
  steamAppId: number | null;
  playtimeMinutes: number;
  lastPlayed: Date | null;
  steamReviewScore: number | null;
  steamReviewSummary: string | null;
  releaseYear: number | null;
  genres: string[] | null;
  tags: string[] | null;
  achievementsUnlocked: number | null;
  achievementsTotal: number | null;
  achievementPercent: number | null;
  completionType: CompletionType;
  backlogSlot: BacklogSlot;
  priorityScore: number;
  rawImportMetadata: Record<string, unknown>;
};

export type CsvPreview = {
  filename: string;
  rowCount: number;
  validCount: number;
  skippedCount: number;
  headers: string[];
  mapping: CsvMapping;
  unknownColumns: string[];
  rows: CsvPreviewRow[];
};

export type QueueCandidate = Pick<
  GameSummary,
  | "id"
  | "title"
  | "backlogSlot"
  | "completionType"
  | "priorityScore"
  | "personalInterest"
  | "estimatedHours"
  | "queueLocked"
  | "queueRank"
> & {
  tags?: string[] | null;
  playtimeMinutes?: number;
  steamReviewScore?: number | null;
  releaseYear?: number | null;
  lastPlayed?: Date | string | null;
  status?: GameStatus;
  currentRotation?: boolean;
  syncState?: SyncState;
  dateAdded?: Date | string | null;
  parkedForLater?: boolean;
};

export type QueueExplanation = {
  gameId: string;
  rank: number;
  reason: string;
  score: number;
};

export type Warning = {
  code: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};
