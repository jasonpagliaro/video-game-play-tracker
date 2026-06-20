import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { PARKING_COMPLETION_TYPES } from "@/lib/backlog/constants";
import { requireUser } from "@/lib/auth";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function ParkingLotPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const parked = games.filter((game) => game.status === "parked" || PARKING_COMPLETION_TYPES.includes(game.completionType));
  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Parking Lot" description="Casual, endless, sandbox, multiplayer, live-service, roguelike, or not-now games." />
      <GameTable games={parked} settings={settings} view="parking" />
    </div>
  );
}

