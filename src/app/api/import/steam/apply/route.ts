import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { applySteamLibraryImport, type ImportDecision } from "@/lib/db/repository";
import { fetchSteamLibraryPreview } from "@/lib/steam/client";

export async function POST(request: Request) {
  const user = await requireUser();
  try {
    const body = (await request.json()) as { identifier?: unknown; decision?: unknown };
    const identifier = String(body.identifier ?? "").trim();
    const decision = String(body.decision ?? "review") as ImportDecision;
    const library = await fetchSteamLibraryPreview(identifier, { sampleLimit: 0 });
    const result = await applySteamLibraryImport({ user, library, decision });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Steam import failed." },
      { status: 400 },
    );
  }
}
