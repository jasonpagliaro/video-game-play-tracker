import { CsvImportPanel } from "@/components/import/csv-import-panel";
import { PageHeader } from "@/components/backlog/page-header";

export default function ImportPage() {
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Import" description="Upload a Steam library CSV, preview column mapping and inferred categories, then upsert without overwriting manual decisions." />
      <CsvImportPanel />
    </div>
  );
}

