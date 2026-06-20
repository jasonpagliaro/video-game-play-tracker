import type { AppSettings, GameSummary, Warning } from "./types";
import { summarizeRotationVariety, validateRotation } from "./rotation";

export function summarizeWarnings(games: GameSummary[], settings: AppSettings): Warning[] {
  const warnings: Warning[] = [];
  const rotation = validateRotation(games, settings);
  const installedCount = games.filter((game) => game.installed).length;
  const active = games.filter((game) => game.currentRotation);
  const queued = games.filter((game) => game.queueRank != null).sort((a, b) => (a.queueRank ?? 0) - (b.queueRank ?? 0));

  if (!rotation.valid) {
    warnings.push({
      code: "active_limit_exceeded",
      title: "Active rotation exceeds configured limit",
      detail: `${rotation.activeCount} games are active, but the configured limit is ${rotation.maxActiveCount}.`,
      severity: "critical",
    });
  }

  if (settings.maxInstalledCount != null && installedCount > settings.maxInstalledCount) {
    warnings.push({
      code: "installed_limit_exceeded",
      title: "Too many games installed",
      detail: `${installedCount} games are installed, above the configured limit of ${settings.maxInstalledCount}.`,
      severity: "warning",
    });
  }

  warnings.push(...summarizeRotationVariety(active));
  const badQueueRun = findQueueRun(queued);
  if (badQueueRun) {
    warnings.push({
      code: "queue_variety_poor",
      title: "Future queue has a category cluster",
      detail: `${badQueueRun.count} nearby queued games share the ${badQueueRun.slot} slot.`,
      severity: "warning",
    });
  }

  return warnings;
}

function findQueueRun(queued: GameSummary[]) {
  let currentSlot = "";
  let count = 0;
  for (const game of queued) {
    if (game.backlogSlot === currentSlot) {
      count += 1;
    } else {
      currentSlot = game.backlogSlot;
      count = 1;
    }
    if (count >= 4) return { slot: currentSlot, count };
  }
  return null;
}

