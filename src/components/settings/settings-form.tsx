import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AppSettings } from "@/lib/backlog/types";
import { updateSettingsAction } from "@/server/actions/settings-actions";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  return (
    <form action={updateSettingsAction} className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rotation and install rules</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <NumberField name="maxActiveRotationCount" label="Max active rotation" defaultValue={settings.maxActiveRotationCount} min={1} />
          <NumberField name="maxInstalledCount" label="Max installed warning count" defaultValue={settings.maxInstalledCount ?? ""} min={1} />
          <NumberField name="checkinIntervalDays" label="Check-in interval days" defaultValue={settings.checkinIntervalDays} min={1} />
          <NumberField name="checkinIntervalHoursPlayed" label="Check-in interval hours played" defaultValue={settings.checkinIntervalHoursPlayed} min={1} />
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
          <NumberField name="queueSlidingWindowSize" label="Queue sliding window size" defaultValue={settings.queueSlidingWindowSize} min={3} />
          <Separator />
          <BooleanField name="autoQueueNewImports" label="Auto-queue new imports by default" checked={settings.autoQueueNewImports} />
          <BooleanField
            name="protectManualFieldsFromSync"
            label="Protect manually edited slot/type from sync inference"
            checked={settings.protectManualFieldsFromSync}
          />
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button type="submit">Save settings</Button>
      </div>
    </form>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
  min?: number;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type="number" min={min} defaultValue={defaultValue} />
    </div>
  );
}

function BooleanField({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
      <Checkbox name={name} defaultChecked={checked} />
      <span>{label}</span>
    </label>
  );
}

