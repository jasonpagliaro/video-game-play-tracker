import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { WarningPanel } from "@/components/warnings/warning-panel";
import { requireUser } from "@/lib/auth";
import { summarizeWarnings } from "@/lib/backlog/warnings";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function RotationPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const active = games.filter((game) => game.currentRotation);
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader
        title="Current Rotation"
        description={`Active games where current_rotation is true. Limit: ${settings.maxActiveRotationCount}.`}
      />
      <WarningPanel warnings={summarizeWarnings(games, settings).filter((warning) => warning.code.includes("rotation") || warning.code.includes("active"))} />
      <GameTable games={active.length ? active : games} settings={settings} view="rotation" />
    </div>
  );
}

