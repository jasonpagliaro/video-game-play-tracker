import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

import {
  BACKLOG_SLOTS,
  CHECKIN_DECISIONS,
  COMPLETION_TYPES,
  GAME_STATUSES,
  MILESTONE_TYPES,
  PERSONAL_INTERESTS,
  SYNC_STATES,
  SYNC_STATUSES,
  SYNC_TYPES,
} from "@/lib/backlog/constants";

export const gameStatusEnum = pgEnum("game_status", GAME_STATUSES);
export const backlogSlotEnum = pgEnum("backlog_slot", BACKLOG_SLOTS);
export const completionTypeEnum = pgEnum("completion_type", COMPLETION_TYPES);
export const personalInterestEnum = pgEnum("personal_interest", PERSONAL_INTERESTS);
export const syncStateEnum = pgEnum("sync_state", SYNC_STATES);
export const syncTypeEnum = pgEnum("sync_type", SYNC_TYPES);
export const syncStatusEnum = pgEnum("sync_status", SYNC_STATUSES);
export const checkinDecisionEnum = pgEnum("checkin_decision", CHECKIN_DECISIONS);
export const milestoneTypeEnum = pgEnum("milestone_type", MILESTONE_TYPES);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const appSettings = pgTable(
  "app_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    maxActiveRotationCount: integer("max_active_rotation_count").notNull().default(5),
    maxInstalledCount: integer("max_installed_count"),
    checkinIntervalDays: integer("checkin_interval_days").notNull().default(7),
    checkinIntervalHoursPlayed: integer("checkin_interval_hours_played").notNull().default(2),
    completedSetsInstalledFalse: boolean("completed_sets_installed_false").notNull().default(true),
    dnfSetsInstalledFalse: boolean("dnf_sets_installed_false").notNull().default(true),
    parkedSetsInstalledFalse: boolean("parked_sets_installed_false").notNull().default(true),
    inProgressSetsInstalledTrue: boolean("in_progress_sets_installed_true").notNull().default(true),
    inProgressAddsToRotationWhenSpace: boolean("in_progress_adds_to_rotation_when_space")
      .notNull()
      .default(true),
    autoQueueNewImports: boolean("auto_queue_new_imports").notNull().default(false),
    protectManualFieldsFromSync: boolean("protect_manual_fields_from_sync").notNull().default(true),
    steamAutoSyncEnabled: boolean("steam_auto_sync_enabled").notNull().default(true),
    steamSyncIntervalDays: integer("steam_sync_interval_days").notNull().default(1),
    steamSyncIntervalHours: integer("steam_sync_interval_hours").notNull().default(0),
    queueSlidingWindowSize: integer("queue_sliding_window_size").notNull().default(5),
    rotationSkipCooldownDays: integer("rotation_skip_cooldown_days").notNull().default(90),
    rotationSkipLimit: integer("rotation_skip_limit").notNull().default(3),
    parkedReassessmentDays: integer("parked_reassessment_days").notNull().default(180),
    slotWeights: jsonb("slot_weights").$type<Record<string, number>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("app_settings_user_id_uq").on(table.userId),
    check("app_settings_max_active_positive", sql`${table.maxActiveRotationCount} > 0`),
    check("app_settings_rotation_skip_cooldown_positive", sql`${table.rotationSkipCooldownDays} > 0`),
    check("app_settings_rotation_skip_limit_positive", sql`${table.rotationSkipLimit} > 0`),
    check("app_settings_parked_reassessment_positive", sql`${table.parkedReassessmentDays} > 0`),
    check("app_settings_steam_sync_days_nonnegative", sql`${table.steamSyncIntervalDays} >= 0`),
    check(
      "app_settings_steam_sync_hours_range",
      sql`${table.steamSyncIntervalHours} >= 0 and ${table.steamSyncIntervalHours} <= 23`,
    ),
    check(
      "app_settings_steam_sync_interval_positive",
      sql`${table.steamSyncIntervalDays} > 0 or ${table.steamSyncIntervalHours} > 0`,
    ),
  ],
);

export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    steamAppId: integer("steam_app_id"),
    steamid64Owner: text("steamid64_owner"),
    title: text("title").notNull(),
    normalizedTitle: text("normalized_title").notNull(),
    source: text("source").notNull().default("Steam"),
    playtimeMinutes: integer("playtime_minutes").notNull().default(0),
    playtimeWindowsMinutes: integer("playtime_windows_minutes"),
    playtimeMacMinutes: integer("playtime_mac_minutes"),
    playtimeLinuxMinutes: integer("playtime_linux_minutes"),
    lastPlayed: timestamp("last_played", { withTimezone: true }),
    achievementsUnlocked: integer("achievements_unlocked"),
    achievementsTotal: integer("achievements_total"),
    achievementPercent: doublePrecision("achievement_percent"),
    steamReviewScore: integer("steam_review_score"),
    steamReviewSummary: text("steam_review_summary"),
    releaseYear: integer("release_year"),
    genres: jsonb("genres").$type<string[] | null>(),
    tags: jsonb("tags").$type<string[] | null>(),
    estimatedHours: doublePrecision("estimated_hours"),
    completionType: completionTypeEnum("completion_type").notNull().default("unknown"),
    backlogSlot: backlogSlotEnum("backlog_slot").notNull().default("experimental"),
    priorityScore: integer("priority_score").notNull().default(50),
    queueRank: integer("queue_rank"),
    queueLocked: boolean("queue_locked").notNull().default(false),
    rotationSkipCount: integer("rotation_skip_count").notNull().default(0),
    rotationSkipUntil: timestamp("rotation_skip_until", { withTimezone: true }),
    rotationLastSkippedAt: timestamp("rotation_last_skipped_at", { withTimezone: true }),
    parkedForLater: boolean("parked_for_later").notNull().default(false),
    reassessAfter: timestamp("reassess_after", { withTimezone: true }),
    status: gameStatusEnum("status").notNull().default("not_started"),
    installed: boolean("installed").notNull().default(false),
    currentRotation: boolean("current_rotation").notNull().default(false),
    dateAdded: timestamp("date_added", { withTimezone: true }).notNull().defaultNow(),
    dateStarted: timestamp("date_started", { withTimezone: true }),
    dateCompleted: timestamp("date_completed", { withTimezone: true }),
    dateDnf: timestamp("date_dnf", { withTimezone: true }),
    dnfReason: text("dnf_reason"),
    personalInterest: personalInterestEnum("personal_interest").notNull().default("unknown"),
    syncState: syncStateEnum("sync_state").notNull().default("imported"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenInSyncAt: timestamp("last_seen_in_sync_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    notes: text("notes"),
    manualBacklogSlot: boolean("manual_backlog_slot").notNull().default(false),
    manualCompletionType: boolean("manual_completion_type").notNull().default(false),
    rawImportMetadata: jsonb("raw_import_metadata").$type<Record<string, unknown> | null>(),
    ...timestamps,
  },
  (table) => [
    index("games_user_status_idx").on(table.userId, table.status),
    index("games_user_rotation_idx").on(table.userId, table.currentRotation),
    index("games_user_queue_idx").on(table.userId, table.queueRank),
    index("games_user_reassess_idx").on(table.userId, table.reassessAfter),
    uniqueIndex("games_user_steam_app_id_uq")
      .on(table.userId, table.steamAppId)
      .where(sql`${table.steamAppId} is not null`),
    uniqueIndex("games_user_title_source_uq")
      .on(table.userId, table.normalizedTitle, table.source)
      .where(sql`${table.steamAppId} is null`),
    uniqueIndex("games_user_queue_rank_uq")
      .on(table.userId, table.queueRank)
      .where(sql`${table.queueRank} is not null`),
    check("games_playtime_nonnegative", sql`${table.playtimeMinutes} >= 0`),
    check("games_rotation_skip_count_nonnegative", sql`${table.rotationSkipCount} >= 0`),
  ],
);

export const steamAccounts = pgTable("steam_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  customProfileId: text("custom_profile_id"),
  steamid64: text("steamid64"),
  profileUrl: text("profile_url"),
  apiKeyEncryptedOrEnvReference: text("api_key_encrypted_or_env_reference"),
  syncEnabled: boolean("sync_enabled").notNull().default(false),
  lastLibrarySyncAt: timestamp("last_library_sync_at", { withTimezone: true }),
  lastAchievementSyncAt: timestamp("last_achievement_sync_at", { withTimezone: true }),
  lastPlaytimeSyncAt: timestamp("last_playtime_sync_at", { withTimezone: true }),
  ...timestamps,
});

export const rotationSlots = pgTable("rotation_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  slotName: backlogSlotEnum("slot_name").notNull(),
  maxActiveCount: integer("max_active_count").notNull().default(1),
  desiredWeight: doublePrecision("desired_weight"),
  description: text("description"),
  ...timestamps,
});

export const importBatches = pgTable("import_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  filename: text("filename").notNull(),
  rowCount: integer("row_count").notNull().default(0),
  addedCount: integer("added_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  notes: text("notes"),
});

export const syncRuns = pgTable("sync_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  steamAccountId: uuid("steam_account_id").references(() => steamAccounts.id, { onDelete: "set null" }),
  syncType: syncTypeEnum("sync_type").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: syncStatusEnum("status").notNull().default("success"),
  addedCount: integer("added_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  missingCount: integer("missing_count").notNull().default(0),
  errorMessage: text("error_message"),
  notes: text("notes"),
});

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  milestoneName: text("milestone_name").notNull(),
  milestoneType: milestoneTypeEnum("milestone_type").notNull().default("manual"),
  targetValue: text("target_value"),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  ...timestamps,
});

export const checkIns = pgTable("check_ins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  checkinDate: timestamp("checkin_date", { withTimezone: true }).notNull().defaultNow(),
  statusAtCheckin: gameStatusEnum("status_at_checkin").notNull(),
  hoursSinceLastCheckin: doublePrecision("hours_since_last_checkin"),
  funRating: integer("fun_rating").notNull(),
  frictionRating: integer("friction_rating").notNull(),
  desireToContinueRating: integer("desire_to_continue_rating").notNull(),
  decision: checkinDecisionEnum("decision").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const statusHistory = pgTable("status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  previousStatus: gameStatusEnum("previous_status"),
  newStatus: gameStatusEnum("new_status").notNull(),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const categoryBalanceSnapshots = pgTable("category_balance_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  snapshotDate: timestamp("snapshot_date", { withTimezone: true }).notNull().defaultNow(),
  backlogSlot: backlogSlotEnum("backlog_slot").notNull(),
  completionType: completionTypeEnum("completion_type").notNull(),
  status: gameStatusEnum("status").notNull(),
  count: integer("count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamesRelations = relations(games, ({ many }) => ({
  milestones: many(milestones),
  checkIns: many(checkIns),
  statusHistory: many(statusHistory),
}));

export const milestonesRelations = relations(milestones, ({ one }) => ({
  game: one(games, { fields: [milestones.gameId], references: [games.id] }),
}));

export const checkInsRelations = relations(checkIns, ({ one }) => ({
  game: one(games, { fields: [checkIns.gameId], references: [games.id] }),
}));

export const rlsAuthenticatedRole = authenticatedRole;
