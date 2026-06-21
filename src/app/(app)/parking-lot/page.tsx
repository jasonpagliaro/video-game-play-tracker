import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { PARKING_COMPLETION_TYPES } from "@/lib/backlog/constants";
import { isDoneForNowCandidate } from "@/lib/backlog/status";
import { requireUser } from "@/lib/auth";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function ParkingLotPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const parked = games.filter(
    (game) =>
      (game.status === "parked" || PARKING_COMPLETION_TYPES.includes(game.completionType)) &&
      game.status !== "completed" &&
      game.status !== "done_for_now" &&
      game.status !== "dnf" &&
      game.status !== "wont_complete",
  );
  const doneForNowCandidates = parked.filter(isDoneForNowCandidate);
  const candidateIds = new Set(doneForNowCandidates.map((game) => game.id));
  const remainingParked = parked.filter((game) => !candidateIds.has(game.id));

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader title="Parking Lot" description="Casual, endless, sandbox, multiplayer, live-service, roguelike, or not-now games." />
      {doneForNowCandidates.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-base font-semibold tracking-normal">Done for Now Candidates</h2>
          <GameTable games={doneForNowCandidates} settings={settings} view="parking" />
        </section>
      ) : null}
      <section className="grid gap-2">
        <h2 className="text-base font-semibold tracking-normal">Parking Lot</h2>
        <GameTable games={remainingParked} settings={settings} view="parking" />
      </section>
    </div>
  );
}
