import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { requireUser } from "@/lib/auth";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function DnfPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="DNF / Won't Complete" description="Valid final decisions, with DNF reasons surfaced in the notes preview." />
      <GameTable games={games.filter((game) => game.status === "dnf" || game.status === "wont_complete")} settings={settings} view="dnf" />
    </div>
  );
}

