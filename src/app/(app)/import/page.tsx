import { CsvImportPanel } from "@/components/import/csv-import-panel";
import { SteamImportPanel } from "@/components/import/steam-import-panel";
import { PageHeader } from "@/components/backlog/page-header";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db/repository";

export default async function ImportPage() {
  const user = await requireUser();
  const settings = await getSettings(user);
  const defaultDecision = settings.autoQueueNewImports ? "queue" : "review";

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader
        title="Import"
        description="Sync a visible Steam library or upload a Steam CSV, then upsert without overwriting manual decisions."
      />
      <SteamImportPanel defaultDecision={defaultDecision} />
      <CsvImportPanel defaultDecision={defaultDecision} />
    </div>
  );
}
