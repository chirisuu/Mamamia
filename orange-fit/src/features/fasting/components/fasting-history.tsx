import { CheckCircle2, CircleSlash, History, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat-tile";
import { localDateInTz } from "@/lib/dates";
import { formatNumber, formatShortDate } from "@/lib/format";
import type { FastingStats } from "@/lib/nutrition";
import { timeOfDay } from "@/features/notifications/lib/time";
import { durationHours, formatHours, protocolLabel, reachedTarget } from "../lib/fasting-view";
import type { FastingSession } from "../server/fasting";

export function FastingStatsTiles({ stats, reachedCount }: { stats: FastingStats; reachedCount: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile label="Ayunos terminados" icon={Timer} value={formatNumber(stats.completedSessions)} hint={`${reachedCount} llegaron a su meta`} />
      <StatTile
        label="Promedio"
        value={stats.averageHours == null ? null : formatHours(stats.averageHours)}
        hint={stats.longestHours == null ? "Sin ayunos terminados" : `El más largo: ${formatHours(stats.longestHours)}`}
      />
    </div>
  );
}

export function FastingHistory({ sessions, timeZone }: { sessions: FastingSession[]; timeZone: string }) {
  if (sessions.length === 0) {
    return <EmptyState icon={History} title="Aún no hay ayunos en tu historial" description="Cuando termines o canceles un ayuno, aparecerá aquí." />;
  }
  return (
    <ul className="grid gap-2">
      {sessions.slice(0, 30).map((s) => {
        const ended = s.endedAt ?? s.startedAt;
        const hours = durationHours(s.startedAt, ended);
        const reached = s.status === "completed" && reachedTarget(s.startedAt, ended, s.targetHours);
        return (
          <li key={s.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              {s.status === "cancelled" ? (
                <CircleSlash className="size-[18px]" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-[18px]" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {formatShortDate(localDateInTz(new Date(s.startedAt), timeZone))} · {timeOfDay(s.startedAt, timeZone)}
              </p>
              <p className="text-sm text-muted-foreground">{protocolLabel(s.protocol, s.targetHours)}</p>
            </div>
            <div className="text-right">
              <p className="font-medium tabular-nums">{s.status === "cancelled" ? "—" : formatHours(hours)}</p>
              {s.status === "cancelled" ? (
                <Badge variant="secondary">Cancelado</Badge>
              ) : reached ? (
                <Badge variant="success">Meta cumplida</Badge>
              ) : (
                <Badge variant="soft">Terminado</Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
