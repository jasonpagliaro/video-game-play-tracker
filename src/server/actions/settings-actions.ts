"use server";

import { revalidatePath } from "next/cache";

import {
  parseIntegerInRange,
  parseNonnegativeInteger,
  parseOptionalPositiveInteger,
  parsePositiveInteger,
  type AutoSaveResult,
  type AutoSaveSettingsFieldInput,
} from "@/lib/backlog/autosave";
import { requireUser } from "@/lib/auth";
import { updateSettings } from "@/lib/db/repository";
import type { AppSettings } from "@/lib/backlog/types";

function revalidateSettings() {
  revalidatePath("/");
  revalidatePath("/rotation");
  revalidatePath("/queue");
  revalidatePath("/ongoing");
  revalidatePath("/settings");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to save setting.";
}

export async function autoSaveSettingsFieldAction(
  input: AutoSaveSettingsFieldInput,
): Promise<AutoSaveResult<{ field: AutoSaveSettingsFieldInput["field"] }>> {
  const user = await requireUser();
  try {
    const patch: Partial<AppSettings> = {};

    if (input.field === "maxActiveRotationCount") {
      const parsed = parsePositiveInteger(input.value, "Max active rotation", 1);
      if (!parsed.ok) return parsed;
      patch.maxActiveRotationCount = parsed.value;
    } else if (input.field === "maxInstalledCount") {
      const parsed = parseOptionalPositiveInteger(input.value, "Max installed warning count", 1);
      if (!parsed.ok) return parsed;
      patch.maxInstalledCount = parsed.value;
    } else if (input.field === "checkinIntervalDays") {
      const parsed = parsePositiveInteger(input.value, "Check-in interval days", 1);
      if (!parsed.ok) return parsed;
      patch.checkinIntervalDays = parsed.value;
    } else if (input.field === "checkinIntervalHoursPlayed") {
      const parsed = parsePositiveInteger(input.value, "Check-in interval hours played", 1);
      if (!parsed.ok) return parsed;
      patch.checkinIntervalHoursPlayed = parsed.value;
    } else if (input.field === "steamSyncIntervalDays") {
      const parsed = parseNonnegativeInteger(input.value, "Steam refresh interval days");
      if (!parsed.ok) return parsed;
      patch.steamSyncIntervalDays = parsed.value;
    } else if (input.field === "steamSyncIntervalHours") {
      const parsed = parseIntegerInRange(input.value, "Steam refresh interval hours", 0, 23);
      if (!parsed.ok) return parsed;
      patch.steamSyncIntervalHours = parsed.value;
    } else if (input.field === "queueSlidingWindowSize") {
      const parsed = parsePositiveInteger(input.value, "Queue sliding window size", 3);
      if (!parsed.ok) return parsed;
      patch.queueSlidingWindowSize = parsed.value;
    } else if (input.field === "rotationSkipCooldownDays") {
      const parsed = parsePositiveInteger(input.value, "Rotation skip cooldown days", 1);
      if (!parsed.ok) return parsed;
      patch.rotationSkipCooldownDays = parsed.value;
    } else if (input.field === "rotationSkipLimit") {
      const parsed = parsePositiveInteger(input.value, "Rotation skip limit", 1);
      if (!parsed.ok) return parsed;
      patch.rotationSkipLimit = parsed.value;
    } else if (input.field === "parkedReassessmentDays") {
      const parsed = parsePositiveInteger(input.value, "Parked reassessment days", 1);
      if (!parsed.ok) return parsed;
      patch.parkedReassessmentDays = parsed.value;
    } else if (typeof input.value === "boolean") {
      patch[input.field] = input.value;
    } else {
      return { ok: false, message: "Invalid setting value." };
    }

    await updateSettings(user, patch);
    revalidateSettings();
    return { ok: true, value: { field: input.field } };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  const maxInstalled = String(formData.get("maxInstalledCount") ?? "").trim();
  await updateSettings(user, {
    maxActiveRotationCount: Number(formData.get("maxActiveRotationCount") ?? 5),
    maxInstalledCount: maxInstalled ? Number(maxInstalled) : null,
    checkinIntervalDays: Number(formData.get("checkinIntervalDays") ?? 7),
    checkinIntervalHoursPlayed: Number(formData.get("checkinIntervalHoursPlayed") ?? 2),
    steamSyncIntervalDays: Number(formData.get("steamSyncIntervalDays") ?? 1),
    steamSyncIntervalHours: Number(formData.get("steamSyncIntervalHours") ?? 0),
    queueSlidingWindowSize: Number(formData.get("queueSlidingWindowSize") ?? 5),
    rotationSkipCooldownDays: Number(formData.get("rotationSkipCooldownDays") ?? 90),
    rotationSkipLimit: Number(formData.get("rotationSkipLimit") ?? 3),
    parkedReassessmentDays: Number(formData.get("parkedReassessmentDays") ?? 180),
    completedSetsInstalledFalse: formData.get("completedSetsInstalledFalse") === "on",
    dnfSetsInstalledFalse: formData.get("dnfSetsInstalledFalse") === "on",
    parkedSetsInstalledFalse: formData.get("parkedSetsInstalledFalse") === "on",
    inProgressSetsInstalledTrue: formData.get("inProgressSetsInstalledTrue") === "on",
    inProgressAddsToRotationWhenSpace: formData.get("inProgressAddsToRotationWhenSpace") === "on",
    autoQueueNewImports: formData.get("autoQueueNewImports") === "on",
    steamAutoSyncEnabled: formData.get("steamAutoSyncEnabled") === "on",
    protectManualFieldsFromSync: formData.get("protectManualFieldsFromSync") === "on",
  });
  revalidateSettings();
}
