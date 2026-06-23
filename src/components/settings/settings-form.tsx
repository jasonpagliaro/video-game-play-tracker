"use client";

import { useRouter } from "next/navigation";

import { AutoSaveStatus } from "@/components/autosave/auto-save-status";
import { useAutoSaveField } from "@/components/autosave/use-auto-save-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AutoSaveSettingsFieldInput } from "@/lib/backlog/autosave";
import type { AppSettings } from "@/lib/backlog/types";
import { autoSaveSettingsFieldAction } from "@/server/actions/settings-actions";

type NumberSettingField = Extract<AutoSaveSettingsFieldInput, { value: string }>["field"];
type BooleanSettingField = Extract<AutoSaveSettingsFieldInput, { value: boolean }>["field"];

export function SettingsForm({ settings }: { settings: AppSettings }) {
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation and install rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField name="maxActiveRotationCount" label="Max active rotation" defaultValue={settings.maxActiveRotationCount} />
          <NumberField name="maxInstalledCount" label="Max installed warning count" defaultValue={settings.maxInstalledCount ?? ""} />
          <NumberField name="checkinIntervalDays" label="Check-in interval days" defaultValue={settings.checkinIntervalDays} />
          <NumberField
            name="checkinIntervalHoursPlayed"
            label="Check-in interval hours played"
            defaultValue={settings.checkinIntervalHoursPlayed}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation suggestions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <NumberField
            name="rotationSkipCooldownDays"
            label="Skip cooldown days"
            defaultValue={settings.rotationSkipCooldownDays}
          />
          <NumberField name="rotationSkipLimit" label="Skip limit" defaultValue={settings.rotationSkipLimit} />
          <NumberField
            name="parkedReassessmentDays"
            label="Parked reassessment days"
            defaultValue={settings.parkedReassessmentDays}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transition defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <BooleanField name="completedSetsInstalledFalse" label="Completed automatically clears installed" checked={settings.completedSetsInstalledFalse} />
          <BooleanField name="dnfSetsInstalledFalse" label="DNF automatically clears installed" checked={settings.dnfSetsInstalledFalse} />
          <BooleanField name="parkedSetsInstalledFalse" label="Parked automatically clears installed" checked={settings.parkedSetsInstalledFalse} />
          <BooleanField name="inProgressSetsInstalledTrue" label="In Progress automatically sets installed" checked={settings.inProgressSetsInstalledTrue} />
          <BooleanField
            name="inProgressAddsToRotationWhenSpace"
            label="In Progress adds to rotation when capacity exists"
            checked={settings.inProgressAddsToRotationWhenSpace}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import and queue balancing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <NumberField name="queueSlidingWindowSize" label="Queue sliding window size" defaultValue={settings.queueSlidingWindowSize} />
          <Separator />
          <BooleanField name="autoQueueNewImports" label="Auto-queue new imports by default" checked={settings.autoQueueNewImports} />
          <BooleanField
            name="protectManualFieldsFromSync"
            label="Protect manually edited slot/type from sync inference"
            checked={settings.protectManualFieldsFromSync}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Steam auto-refresh</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <BooleanField
            name="steamAutoSyncEnabled"
            label="Automatically refresh saved Steam accounts"
            checked={settings.steamAutoSyncEnabled}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField
              name="steamSyncIntervalDays"
              label="Refresh interval days"
              defaultValue={settings.steamSyncIntervalDays}
              min={0}
            />
            <NumberField
              name="steamSyncIntervalHours"
              label="Refresh interval hours"
              defaultValue={settings.steamSyncIntervalHours}
              min={0}
              max={23}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
  max,
}: {
  name: NumberSettingField;
  label: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
}) {
  const router = useRouter();
  const field = useAutoSaveField<string, { field: AutoSaveSettingsFieldInput["field"] }>({
    initialValue: String(defaultValue),
    save: (value) => autoSaveSettingsFieldAction({ field: name, value }),
    onSaved: () => router.refresh(),
  });

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={name}>{label}</Label>
        <AutoSaveStatus status={field.status} message={field.message} />
      </div>
      <Input
        id={name}
        value={field.value}
        type="number"
        min={min}
        max={max}
        onChange={(event) => field.setAndScheduleSave(event.target.value)}
        onBlur={field.flush}
      />
    </div>
  );
}

function BooleanField({ name, label, checked }: { name: BooleanSettingField; label: string; checked: boolean }) {
  const router = useRouter();
  const field = useAutoSaveField<boolean, { field: AutoSaveSettingsFieldInput["field"] }>({
    initialValue: checked,
    save: (value) => autoSaveSettingsFieldAction({ field: name, value }),
    serialize: (value) => String(value),
    onSaved: () => router.refresh(),
  });

  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
      <span className="flex items-center gap-3">
        <Checkbox checked={field.value} onCheckedChange={(value) => field.setAndSave(value === true)} />
        <span>{label}</span>
      </span>
      <AutoSaveStatus status={field.status} message={field.message} />
    </label>
  );
}
