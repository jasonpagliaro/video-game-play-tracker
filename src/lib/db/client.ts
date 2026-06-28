import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

export type AppUser = {
  id: string;
  email: string | null;
  role?: string;
  accessToken?: string;
};

type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

let client: postgres.Sql | null = null;
let db: PostgresJsDatabase<typeof schema> | null = null;
let runtimeSchemaPromise: Promise<void> | null = null;

export function getDb() {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!client) {
    client = postgres(process.env.DATABASE_URL!, { max: 10, prepare: false });
  }
  if (!db) {
    db = drizzle(client, { schema });
  }
  return db;
}

export async function withUserDb<T>(
  user: AppUser,
  callback: (tx: DbTransaction) => Promise<T>,
) {
  const database = getDb();
  await ensureRuntimeSchema(database);
  return database.transaction(async (tx) => {
    const tokenClaims = user.accessToken
      ? decodeJwtPayload(user.accessToken)
      : { sub: user.id, role: user.role ?? "authenticated" };
    const claims = JSON.stringify({ ...tokenClaims, sub: user.id, role: user.role ?? "authenticated" });
    await tx.execute(sql`select set_config('request.jwt.claims', ${claims}, true)`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${user.id}, true)`);
    await tx.execute(sql.raw("set local role authenticated"));
    return callback(tx);
  });
}

export async function withSystemDb<T>(callback: (tx: DbTransaction) => Promise<T>) {
  const database = getDb();
  await ensureRuntimeSchema(database);
  return database.transaction(callback);
}

async function ensureRuntimeSchema(database: PostgresJsDatabase<typeof schema>) {
  if (!runtimeSchemaPromise) {
    runtimeSchemaPromise = runRuntimeSchemaBootstrap(database);
  }

  try {
    await runtimeSchemaPromise;
  } catch (error) {
    runtimeSchemaPromise = null;
    throw error;
  }
}

async function runRuntimeSchemaBootstrap(database: PostgresJsDatabase<typeof schema>) {
  await database.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('video_game_play_tracker_schema_0004')::bigint)`);
    await tx.execute(sql.raw("alter type game_status add value if not exists 'done_for_now'"));
    await tx.execute(sql.raw(`
      alter table app_settings
        add column if not exists rotation_skip_cooldown_days integer not null default 90,
        add column if not exists rotation_skip_limit integer not null default 3,
        add column if not exists parked_reassessment_days integer not null default 180,
        add column if not exists steam_auto_sync_enabled boolean not null default true,
        add column if not exists steam_sync_interval_days integer not null default 1,
        add column if not exists steam_sync_interval_hours integer not null default 0
    `));
    await tx.execute(sql.raw(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_rotation_skip_cooldown_positive'
        ) then
          alter table app_settings
            add constraint app_settings_rotation_skip_cooldown_positive check (rotation_skip_cooldown_days > 0);
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_rotation_skip_limit_positive'
        ) then
          alter table app_settings
            add constraint app_settings_rotation_skip_limit_positive check (rotation_skip_limit > 0);
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_parked_reassessment_positive'
        ) then
          alter table app_settings
            add constraint app_settings_parked_reassessment_positive check (parked_reassessment_days > 0);
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_steam_sync_days_nonnegative'
        ) then
          alter table app_settings
            add constraint app_settings_steam_sync_days_nonnegative check (steam_sync_interval_days >= 0);
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_steam_sync_hours_range'
        ) then
          alter table app_settings
            add constraint app_settings_steam_sync_hours_range check (
              steam_sync_interval_hours >= 0 and steam_sync_interval_hours <= 23
            );
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'app_settings'::regclass
            and conname = 'app_settings_steam_sync_interval_positive'
        ) then
          alter table app_settings
            add constraint app_settings_steam_sync_interval_positive check (
              steam_sync_interval_days > 0 or steam_sync_interval_hours > 0
            );
        end if;
      end
      $$
    `));
    await tx.execute(sql.raw(`
      alter table games
        add column if not exists rotation_skip_count integer not null default 0,
        add column if not exists rotation_skip_until timestamptz,
        add column if not exists rotation_last_skipped_at timestamptz,
        add column if not exists parked_for_later boolean not null default false,
        add column if not exists reassess_after timestamptz,
        add column if not exists steam_deck_compatibility_category text,
        add column if not exists steam_deck_compatibility_items jsonb,
        add column if not exists protondb_tier text,
        add column if not exists protondb_confidence text,
        add column if not exists protondb_score double precision,
        add column if not exists protondb_report_count integer,
        add column if not exists deck_playability_updated_at timestamptz,
        add column if not exists deck_playability_raw jsonb
    `));
    await tx.execute(sql.raw(`
      do $$
      begin
        if not exists (
          select 1 from pg_constraint
          where conrelid = 'games'::regclass
            and conname = 'games_rotation_skip_count_nonnegative'
        ) then
          alter table games
            add constraint games_rotation_skip_count_nonnegative check (rotation_skip_count >= 0);
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'games'::regclass
            and conname = 'games_protondb_report_count_nonnegative'
        ) then
          alter table games
            add constraint games_protondb_report_count_nonnegative check (
              protondb_report_count is null or protondb_report_count >= 0
            );
        end if;

        if not exists (
          select 1 from pg_constraint
          where conrelid = 'games'::regclass
            and conname = 'games_protondb_score_range'
        ) then
          alter table games
            add constraint games_protondb_score_range check (
              protondb_score is null or (protondb_score >= 0 and protondb_score <= 1)
            );
        end if;
      end
      $$
    `));
    await tx.execute(sql.raw("create index if not exists games_user_reassess_idx on games(user_id, reassess_after)"));
  });
}

function decodeJwtPayload(token: string) {
  const [, payload] = token.split(".");
  if (!payload) return {};
  try {
    return JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}
