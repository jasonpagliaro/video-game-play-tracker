"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { updateSettings } from "@/lib/db/repository";

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  const maxInstalled = String(formData.get("maxInstalledCount") ?? "").trim();
  await updateSettings(user, {
    maxActiveRotationCount: Number(formData.get("maxActiveRotationCount") ?? 5),
    maxInstalledCount: maxInstalled ? Number(maxInstalled) : null,
    checkinIntervalDays: Number(formData.get("checkinIntervalDays") ?? 7),
    checkinIntervalHoursPlayed: Number(formData.get("checkinIntervalHoursPlayed") ?? 2),
    queueSlidingWindowSize: Number(formData.get("queueSlidingWindowSize") ?? 5),
    completedSetsInstalledFalse: formData.get("completedSetsInstalledFalse") === "on",
    dnfSetsInstalledFalse: formData.get("dnfSetsInstalledFalse") === "on",
    parkedSetsInstalledFalse: formData.get("parkedSetsInstalledFalse") === "on",
    inProgressSetsInstalledTrue: formData.get("inProgressSetsInstalledTrue") === "on",
    inProgressAddsToRotationWhenSpace: formData.get("inProgressAddsToRotationWhenSpace") === "on",
    autoQueueNewImports: formData.get("autoQueueNewImports") === "on",
    protectManualFieldsFromSync: formData.get("protectManualFieldsFromSync") === "on",
  });
  revalidatePath("/");
  revalidatePath("/settings");
}

