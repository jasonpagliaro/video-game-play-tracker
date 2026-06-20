import type { BacklogSlot, CompletionType } from "./constants";
import { COMPLETION_TYPE_LABELS, SLOT_LABELS } from "./constants";
import type { AppSettings, GameSummary, Warning } from "./types";

export function validateRotation(
  games: Pick<GameSummary, "id" | "currentRotation" | "backlogSlot" | "completionType">[],
  settings: Pick<AppSettings, "maxActiveRotationCount">,
) {
  const active = games.filter((game) => game.currentRotation);
  return {
    activeCount: active.length,
    maxActiveCount: settings.maxActiveRotationCount,
    valid: active.length <= settings.maxActiveRotationCount,
    overflow: Math.max(0, active.length - settings.maxActiveRotationCount),
  };
}

export function summarizeRotationVariety(active: Pick<GameSummary, "backlogSlot" | "completionType">[]): Warning[] {
  if (active.length < 3) return [];
  const warnings: Warning[] = [];
  const slotCounts = countBy(active.map((game) => game.backlogSlot));
  const typeCounts = countBy(active.map((game) => game.completionType));
  const repeatedSlot = Object.entries(slotCounts).find(([, count]) => count >= Math.max(3, active.length - 1));
  const repeatedType = Object.entries(typeCounts).find(([, count]) => count >= Math.max(3, active.length - 1));

  if (repeatedSlot) {
    warnings.push({
      code: "rotation_slot_cluster",
      title: "Active rotation lacks slot variety",
      detail: `${repeatedSlot[1]} active games are ${SLOT_LABELS[repeatedSlot[0] as BacklogSlot]}.`,
      severity: "warning",
    });
  }
  if (repeatedType) {
    warnings.push({
      code: "rotation_type_cluster",
      title: "Active rotation lacks completion-type variety",
      detail: `${repeatedType[1]} active games are ${COMPLETION_TYPE_LABELS[repeatedType[0] as CompletionType]}.`,
      severity: "warning",
    });
  }
  return warnings;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

