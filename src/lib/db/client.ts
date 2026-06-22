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
  callback: (tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0]) => Promise<T>,
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
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('video_game_play_tracker_schema_0002')::bigint)`);
    await tx.execute(sql.raw(`
      alter table app_settings
        add column if not exists rotation_skip_cooldown_days integer not null default 90,
        add column if not exists rotation_skip_limit integer not null default 3,
        add column if not exists parked_reassessment_days integer not null default 180
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
      end
      $$
    `));
    await tx.execute(sql.raw(`
      alter table games
        add column if not exists rotation_skip_count integer not null default 0,
        add column if not exists rotation_skip_until timestamptz,
        add column if not exists rotation_last_skipped_at timestamptz,
        add column if not exists parked_for_later boolean not null default false,
        add column if not exists reassess_after timestamptz
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
