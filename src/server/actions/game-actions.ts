"use server";

import { revalidatePath } from "next/cache";

import type {
  BacklogSlot,
  CompletionType,
  GameStatus,
  PersonalInterest,
} from "@/lib/backlog/constants";
import {
  isBacklogSlot,
  isCompletionType,
  isGameStatus,
  isPersonalInterest,
  parseQueueRank,
  type AutoSaveGameFieldInput,
  type AutoSaveResult,
  type GameVisibilitySnapshot,
} from "@/lib/backlog/autosave";
import { requireUser } from "@/lib/auth";
import {
  bulkUpdateGames,
  getGameVisibilitySnapshot,
  rebalanceUserQueue,
  setCurrentRotation,
  setInstalled,
  updateGameFields,
  updateGameStatus,
} from "@/lib/db/repository";

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/backlog");
  revalidatePath("/rotation");
  revalidatePath("/queue");
  revalidatePath("/completed");
  revalidatePath("/dnf");
  revalidatePath("/parking-lot");
  revalidatePath("/ongoing");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save change.";
}

async function snapshotForSavedGame(user: Awaited<ReturnType<typeof requireUser>>, gameId: string) {
  const snapshot = await getGameVisibilitySnapshot(user, gameId);
  if (!snapshot) throw new Error("Game not found.");
  return snapshot;
}

export async function autoSaveGameFieldAction(
  input: AutoSaveGameFieldInput,
): Promise<AutoSaveResult<GameVisibilitySnapshot>> {
  const user = await requireUser();
  try {
    if (!input?.gameId) return { ok: false, message: "Game is missing." };

    if (input.field === "status") {
      if (!isGameStatus(String(input.value))) return { ok: false, message: "Invalid status." };
      await updateGameStatus({
        user,
        gameId: input.gameId,
        newStatus: input.value,
        dnfReason: input.dnfReason?.trim() || null,
        replacementGameId: input.replacementGameId?.trim() || null,
      });
    } else if (input.field === "backlogSlot") {
      if (!isBacklogSlot(String(input.value))) return { ok: false, message: "Invalid backlog slot." };
      await updateGameFields(user, input.gameId, { backlogSlot: input.value });
    } else if (input.field === "completionType") {
      if (!isCompletionType(String(input.value))) return { ok: false, message: "Invalid completion type." };
      await updateGameFields(user, input.gameId, { completionType: input.value });
    } else if (input.field === "personalInterest") {
      if (!isPersonalInterest(String(input.value))) return { ok: false, message: "Invalid interest." };
      await updateGameFields(user, input.gameId, { personalInterest: input.value });
    } else if (input.field === "queueRank") {
      const parsed = parseQueueRank(input.value);
      if (!parsed.ok) return parsed;
      await updateGameFields(user, input.gameId, { queueRank: parsed.value });
    } else if (input.field === "notes") {
      await updateGameFields(user, input.gameId, { notes: input.value.trim() ? input.value : null });
    } else if (input.field === "dnfReason") {
      await updateGameFields(user, input.gameId, { dnfReason: input.value.trim() || null });
    } else if (input.field === "installed") {
      if (typeof input.value !== "boolean") return { ok: false, message: "Invalid installed value." };
      await setInstalled(user, input.gameId, input.value);
    } else if (input.field === "currentRotation") {
      if (typeof input.value !== "boolean") return { ok: false, message: "Invalid rotation value." };
      await setCurrentRotation(user, input.gameId, input.value, input.replacementGameId?.trim() || undefined);
    } else {
      return { ok: false, message: "Unsupported field." };
    }

    revalidateApp();
    return { ok: true, value: await snapshotForSavedGame(user, input.gameId) };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function updateGameStatusAction(formData: FormData) {
  const user = await requireUser();
  await updateGameStatus({
    user,
    gameId: String(formData.get("gameId")),
    newStatus: String(formData.get("status")) as GameStatus,
    dnfReason: String(formData.get("dnfReason") ?? "") || null,
    replacementGameId: String(formData.get("replacementGameId") ?? "") || null,
  });
  revalidateApp();
}

export async function toggleInstalledAction(formData: FormData) {
  const user = await requireUser();
  await setInstalled(
    user,
    String(formData.get("gameId")),
    String(formData.get("installed")) === "true",
    (String(formData.get("nextStatus") ?? "") || undefined) as GameStatus | undefined,
  );
  revalidateApp();
}

export async function toggleCurrentRotationAction(formData: FormData) {
  const user = await requireUser();
  await setCurrentRotation(
    user,
    String(formData.get("gameId")),
    String(formData.get("currentRotation")) === "true",
    String(formData.get("replacementGameId") || "") || undefined,
  );
  revalidateApp();
}

export async function updateGameFieldsAction(formData: FormData) {
  const user = await requireUser();
  const queueRankText = String(formData.get("queueRank") ?? "").trim();
  await updateGameFields(user, String(formData.get("gameId")), {
    backlogSlot: formData.get("backlogSlot") ? (String(formData.get("backlogSlot")) as BacklogSlot) : undefined,
    completionType: formData.get("completionType")
      ? (String(formData.get("completionType")) as CompletionType)
      : undefined,
    personalInterest: formData.get("personalInterest")
      ? (String(formData.get("personalInterest")) as PersonalInterest)
      : undefined,
    queueRank: queueRankText === "" ? null : Number(queueRankText),
    queueLocked: formData.get("queueLocked") ? String(formData.get("queueLocked")) === "true" : undefined,
    notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
  });
  revalidateApp();
}

export async function moveQueueItemAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  const direction = String(formData.get("direction"));
  const currentRank = Number(formData.get("currentRank"));
  const nextRank = Math.max(1000, currentRank + (direction === "up" ? -1500 : 1500));
  await updateGameFields(user, gameId, { queueRank: nextRank });
  revalidateApp();
}

export async function rebalanceQueueAction() {
  const user = await requireUser();
  await rebalanceUserQueue(user);
  revalidateApp();
}

export async function bulkUpdateGamesAction(formData: FormData) {
  const user = await requireUser();
  const selectedIds = formData
    .getAll("selectedIds")
    .map(String)
    .filter(Boolean);
  await bulkUpdateGames({
    user,
    gameIds: selectedIds,
    action: String(formData.get("bulkAction") ?? ""),
    status: (String(formData.get("statusValue") ?? "") || undefined) as GameStatus | undefined,
    backlogSlot: (String(formData.get("slotValue") ?? "") || undefined) as BacklogSlot | undefined,
    completionType: (String(formData.get("typeValue") ?? "") || undefined) as CompletionType | undefined,
    personalInterest: (String(formData.get("interestValue") ?? "") || undefined) as PersonalInterest | undefined,
  });
  revalidateApp();
}
