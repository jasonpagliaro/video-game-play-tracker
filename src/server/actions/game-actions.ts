"use server";

import { revalidatePath } from "next/cache";

import type {
  BacklogSlot,
  CompletionType,
  GameStatus,
  PersonalInterest,
} from "@/lib/backlog/constants";
import { requireUser } from "@/lib/auth";
import {
  bulkUpdateGames,
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
    queueRank: queueRankText === "" ? undefined : Number(queueRankText),
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
