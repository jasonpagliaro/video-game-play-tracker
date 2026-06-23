import { getCronSecret } from "@/lib/env";
import { runScheduledSteamRefresh } from "@/lib/steam/scheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = getCronSecret();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledSteamRefresh();
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Scheduled Steam refresh failed." },
      { status: 500 },
    );
  }
}
