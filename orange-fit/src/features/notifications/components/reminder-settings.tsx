"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { formatHour, WEEKDAY_LABELS, type NotificationPrefs } from "@/lib/notifications/prefs";
import { updateNotificationPrefsAction } from "../actions";
import type { PrefsPatch } from "../schemas";

type Section = keyof NotificationPrefs;

type Props = {
  prefs: NotificationPrefs;
  sections: readonly Section[];
  /** Con antecedente de TCA no se ofrece el recordatorio de pesaje. */
  hideWeight?: boolean;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function HourSelect({
  id,
  value,
  hours,
  onChange,
  disabled,
}: {
  id: string;
  value: number;
  hours: number[];
  onChange: (h: number) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))} disabled={disabled}>
      <SelectTrigger id={id} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {hours.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {formatHour(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Row({ id, title, description, checked, onCheckedChange, disabled, children }: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-border py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor={id} className="text-base font-medium">
            {title}
          </Label>
          <p id={`${id}-desc`} className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={`${id}-desc`} />
      </div>
      {checked && children ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div> : null}
    </div>
  );
}

/** Preferencias de recordatorios. Cada cambio se guarda al momento (profiles.notification_prefs). */
export function ReminderSettings({ prefs: initial, sections, hideWeight }: Props) {
  const [prefs, setPrefs] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const idBase = React.useId();

  async function save<S extends Section>(section: S, value: NotificationPrefs[S]) {
    const previous = prefs;
    setPrefs({ ...prefs, [section]: value });
    setSaving(true);
    const res = await updateNotificationPrefsAction({ section, value } as PrefsPatch);
    setSaving(false);
    if (!res.ok) {
      setPrefs(previous);
      toast.error(res.error.fieldErrors ? "Revisa los horarios elegidos." : res.error.message);
      return;
    }
    setPrefs(res.data);
    toast.success("Preferencia guardada.");
  }

  const show = (s: Section) => sections.includes(s);

  return (
    <div className="grid" aria-busy={saving || undefined}>
      {show("water") ? (
        <Row
          id={`${idBase}-water`}
          title="Recordarme tomar agua"
          description={`Cada ${prefs.water.everyHours} h entre las ${formatHour(prefs.water.startHour)} y las ${formatHour(prefs.water.endHour)}, solo si aún no llegas a tu meta.`}
          checked={prefs.water.enabled}
          onCheckedChange={(enabled) => void save("water", { ...prefs.water, enabled })}
          disabled={saving}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-water-start`}>Desde</Label>
            <HourSelect
              id={`${idBase}-water-start`}
              value={prefs.water.startHour}
              hours={range(5, 22).filter((h) => h < prefs.water.endHour)}
              onChange={(startHour) => void save("water", { ...prefs.water, startHour })}
              disabled={saving}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-water-end`}>Hasta</Label>
            <HourSelect
              id={`${idBase}-water-end`}
              value={prefs.water.endHour}
              hours={range(6, 23).filter((h) => h > prefs.water.startHour)}
              onChange={(endHour) => void save("water", { ...prefs.water, endHour })}
              disabled={saving}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-water-every`}>Cada</Label>
            <Select
              value={String(prefs.water.everyHours)}
              onValueChange={(v) => void save("water", { ...prefs.water, everyHours: Number(v) })}
              disabled={saving}
            >
              <SelectTrigger id={`${idBase}-water-every`} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h === 1 ? "1 hora" : `${h} horas`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Row>
      ) : null}

      {show("logging") ? (
        <Row
          id={`${idBase}-logging`}
          title="Recordarme registrar mis comidas"
          description={`Un aviso a las ${formatHour(prefs.logging.hour)} solo si ese día aún no registraste nada.`}
          checked={prefs.logging.enabled}
          onCheckedChange={(enabled) => void save("logging", { ...prefs.logging, enabled })}
          disabled={saving}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-logging-hour`}>Hora</Label>
            <HourSelect
              id={`${idBase}-logging-hour`}
              value={prefs.logging.hour}
              hours={range(10, 22)}
              onChange={(hour) => void save("logging", { ...prefs.logging, hour })}
              disabled={saving}
            />
          </div>
        </Row>
      ) : null}

      {show("weighIn") && !hideWeight ? (
        <Row
          id={`${idBase}-weigh`}
          title="Recordatorio semanal de pesaje"
          description={`Los ${WEEKDAY_LABELS[prefs.weighIn.weekday]?.toLowerCase()} a partir de las ${formatHour(prefs.weighIn.hour)}, si ese día aún no te pesaste.`}
          checked={prefs.weighIn.enabled}
          onCheckedChange={(enabled) => void save("weighIn", { ...prefs.weighIn, enabled })}
          disabled={saving}
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-weigh-day`}>Día</Label>
            <Select
              value={String(prefs.weighIn.weekday)}
              onValueChange={(v) => void save("weighIn", { ...prefs.weighIn, weekday: Number(v) })}
              disabled={saving}
            >
              <SelectTrigger id={`${idBase}-weigh-day`} size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {WEEKDAY_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idBase}-weigh-hour`}>Hora</Label>
            <HourSelect
              id={`${idBase}-weigh-hour`}
              value={prefs.weighIn.hour}
              hours={range(5, 21)}
              onChange={(hour) => void save("weighIn", { ...prefs.weighIn, hour })}
              disabled={saving}
            />
          </div>
        </Row>
      ) : null}

      {show("fasting") ? (
        <Row
          id={`${idBase}-fasting`}
          title="Avisarme cuando complete un ayuno"
          description="Si tienes un ayuno en curso, te avisamos al llegar a tu meta de horas."
          checked={prefs.fasting.enabled}
          onCheckedChange={(enabled) => void save("fasting", { enabled })}
          disabled={saving}
        />
      ) : null}
    </div>
  );
}
