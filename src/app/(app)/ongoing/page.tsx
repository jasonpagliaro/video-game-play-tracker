import { GameTable } from "@/components/backlog/game-table";
import { PageHeader } from "@/components/backlog/page-header";
import { isDoneForNowCandidate, isOpenEndedCompletionType } from "@/lib/backlog/status";
import { requireUser } from "@/lib/auth";
import { getGames, getSettings } from "@/lib/db/repository";

export default async function OngoingPage() {
  const user = await requireUser();
  const [settings, games] = await Promise.all([getSettings(user), getGames(user)]);
  const activeHolding = games.filter(
    (game) =>
      (game.status === "parked" || isOpenEndedCompletionType(game.completionType)) &&
      game.status !== "completed" &&
      game.status !== "done_for_now" &&
      game.status !== "dnf" &&
      game.status !== "wont_complete",
  );
  const doneForNowCandidates = activeHolding.filter(isDoneForNowCandidate);
  const doneCandidateIds = new Set(doneForNowCandidates.map((game) => game.id));
  const ongoing = activeHolding.filter(
    (game) =>
      !doneCandidateIds.has(game.id) &&
      game.status !== "parked" &&
      isOpenEndedCompletionType(game.completionType),
  );
  const parked = activeHolding.filter(
    (game) => !doneCandidateIds.has(game.id) && game.status === "parked",
  );

  return (
    <div className="grid gap-4 p-4 lg:p-6">
      <PageHeader
        title="Ongoing & Parked"
        description="No-finish-line games, done-for-now candidates, and intentional not-now picks."
      />
      {doneForNowCandidates.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-base font-semibold tracking-normal">Ready to Mark Done for Now</h2>
          <GameTable games={doneForNowCandidates} settings={settings} view="ongoing" />
        </section>
      ) : null}
      <section className="grid gap-2">
        <h2 className="text-base font-semibold tracking-normal">Ongoing / No Finish Line</h2>
        <GameTable games={ongoing} settings={settings} view="ongoing" />
      </section>
      <section className="grid gap-2">
        <h2 className="text-base font-semibold tracking-normal">Parked / Not Now</h2>
        <GameTable games={parked} settings={settings} view="ongoing" />
      </section>
    </div>
  );
}
