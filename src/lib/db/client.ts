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
