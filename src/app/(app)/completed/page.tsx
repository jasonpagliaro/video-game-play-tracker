import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { requireUser } from "@/lib/auth";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function CompletedPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const completed = games.filter((game) => game.status === "completed" || game.status === "done_for_now");
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Completed" description="Finished games and open-ended games that are done for now." />
      <GameTable games={completed} settings={settings} view="completed" />
    </div>
  );
}
