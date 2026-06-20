import { PageHeader } from "@/components/backlog/page-header";
import { SettingsForm } from "@/components/settings/settings-form";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/db/repository";

export default async function SettingsPage() {
  const user = await requireUser();
  const settings = await getSettings(user);
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Settings" description="Configure rotation limits, transition defaults, import handling, and queue balancing weights." />
      <SettingsForm settings={settings} />
    </div>
  );
}

