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
  type AutoSaveGameFieldInput,
  type AutoSaveResult,
  type GameVisibilitySnapshot,
} from "@/lib/backlog/autosave";
import { isQueueCommand, isQueueSortPreset } from "@/lib/backlog/queue";
import { requireUser } from "@/lib/auth";
import {
  addQueuedGameToRotation,
  applyQueueCommand,
  bulkUpdateGames,
  fillRotationFromQueue,
  getGameVisibilitySnapshot,
  markGameWontCompleteFromSuggestion,
  parkGameForLater,
  rebalanceUserQueue,
  returnParkedGameToQueue,
  setCurrentRotation,
  setInstalled,
  skipRotationSuggestion,
  sortUserQueue,
  updateGameFields,
  updateGameStatus,
} from "@/lib/db/repository";

function revalidateApp(gameId?: string) {
  revalidatePath("/");
  revalidatePath("/backlog");
  revalidatePath("/rotation");
  revalidatePath("/queue");
  revalidatePath("/completed");
  revalidatePath("/dnf");
  revalidatePath("/parking-lot");
  revalidatePath("/ongoing");
  if (gameId) revalidatePath(`/games/${gameId}`);
}

function revalidateGame(gameId: string) {
  revalidatePath(`/games/${gameId}`);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save change.";
}

export type ActionFeedbackState = {
  status: "idle" | "success" | "error";
  message: string | null;
  submittedAt: number;
};

function actionFeedback(status: Exclude<ActionFeedbackState["status"], "idle">, message: string): ActionFeedbackState {
  return { status, message, submittedAt: Date.now() };
}

function queueCommandFeedbackMessage(command: string) {
  if (command === "add_to_queue") return "Added to queue.";
  if (command === "force_next_in_queue") return "Moved to Up next.";
  if (command === "remove_from_queue") return "Removed from queue.";
  if (command === "move_to_top") return "Moved to top.";
  if (command === "move_to_bottom") return "Moved to bottom.";
  if (command === "promote") return "Moved up.";
  if (command === "demote") return "Moved down.";
  if (command === "move_before" || command === "move_after") return "Queue position updated.";
  return "Queue updated.";
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
    let revalidateFullApp = true;

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
      const { rebalanced } = await updateGameFields(user, input.gameId, { personalInterest: input.value });
      revalidateFullApp = rebalanced;
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

    if (revalidateFullApp) {
      revalidateApp(input.gameId);
    } else {
      revalidateGame(input.gameId);
    }
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
  await updateGameFields(user, String(formData.get("gameId")), {
    backlogSlot: formData.get("backlogSlot") ? (String(formData.get("backlogSlot")) as BacklogSlot) : undefined,
    completionType: formData.get("completionType")
      ? (String(formData.get("completionType")) as CompletionType)
      : undefined,
    personalInterest: formData.get("personalInterest")
      ? (String(formData.get("personalInterest")) as PersonalInterest)
      : undefined,
    queueLocked: formData.get("queueLocked") ? String(formData.get("queueLocked")) === "true" : undefined,
    notes: formData.get("notes") ? String(formData.get("notes")) : undefined,
  });
  revalidateApp();
}

export async function queueCommandAction(formData: FormData) {
  const user = await requireUser();
  await runQueueCommandAction(user, formData);
}

async function runQueueCommandAction(user: Awaited<ReturnType<typeof requireUser>>, formData: FormData) {
  const gameId = String(formData.get("gameId"));
  const command = String(formData.get("command"));
  if (!isQueueCommand(command)) throw new Error("Invalid queue command.");
  await applyQueueCommand(user, {
    gameId,
    command,
    targetGameId: String(formData.get("targetGameId") ?? "") || undefined,
  });
  revalidateApp();
}

export async function queueCommandFeedbackAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  const user = await requireUser();
  try {
    await runQueueCommandAction(user, formData);
    return actionFeedback("success", queueCommandFeedbackMessage(String(formData.get("command"))));
  } catch (error) {
    return actionFeedback("error", errorMessage(error));
  }
}

export async function sortQueueAction(formData: FormData) {
  const user = await requireUser();
  await runSortQueueAction(user, formData);
}

async function runSortQueueAction(user: Awaited<ReturnType<typeof requireUser>>, formData: FormData) {
  const preset = String(formData.get("preset"));
  if (!isQueueSortPreset(preset)) throw new Error("Invalid queue sort.");
  await sortUserQueue(user, preset);
  revalidateApp();
}

export async function sortQueueFeedbackAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  const user = await requireUser();
  try {
    await runSortQueueAction(user, formData);
    return actionFeedback("success", "Queue sorted.");
  } catch (error) {
    return actionFeedback("error", errorMessage(error));
  }
}

export async function rebalanceQueueAction() {
  const user = await requireUser();
  await rebalanceUserQueue(user);
  revalidateApp();
}

export async function fillRotationFromQueueAction() {
  const user = await requireUser();
  await fillRotationFromQueue(user);
  revalidateApp();
}

export async function addRotationSuggestionToRotationAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  await addQueuedGameToRotation(user, gameId);
  revalidateApp(gameId);
}

export async function skipRotationSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  await skipRotationSuggestion(user, gameId);
  revalidateApp(gameId);
}

export async function parkGameForLaterAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  await parkGameForLater(user, gameId);
  revalidateApp(gameId);
}

export async function returnParkedGameToQueueAction(formData: FormData) {
  const user = await requireUser();
  await runReturnParkedGameToQueueAction(user, formData);
}

async function runReturnParkedGameToQueueAction(user: Awaited<ReturnType<typeof requireUser>>, formData: FormData) {
  const gameId = String(formData.get("gameId"));
  await returnParkedGameToQueue(user, gameId);
  revalidateApp(gameId);
}

export async function returnParkedGameToQueueFeedbackAction(
  _state: ActionFeedbackState,
  formData: FormData,
): Promise<ActionFeedbackState> {
  const user = await requireUser();
  try {
    await runReturnParkedGameToQueueAction(user, formData);
    return actionFeedback("success", "Returned to queue.");
  } catch (error) {
    return actionFeedback("error", errorMessage(error));
  }
}

export async function markGameWontCompleteFromSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const gameId = String(formData.get("gameId"));
  await markGameWontCompleteFromSuggestion(user, gameId);
  revalidateApp(gameId);
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
