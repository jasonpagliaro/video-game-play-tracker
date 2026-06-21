import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { fetchSteamLibraryPreview } from "@/lib/steam/client";

export async function POST(request: Request) {
  await requireUser();
  try {
    const body = (await request.json()) as { identifier?: unknown };
    const identifier = String(body.identifier ?? "").trim();
    const preview = await fetchSteamLibraryPreview(identifier);
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Steam preview failed." },
      { status: 400 },
    );
  }
}
