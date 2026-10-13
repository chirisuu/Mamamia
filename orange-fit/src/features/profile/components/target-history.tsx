import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatKcal, formatShortDate } from "@/lib/format";
import { History } from "lucide-react";
import type { Tables } from "@/lib/db/database.types";
import { targetSourceLabel } from "../target-inputs";

type Row = Tables<"nutrition_targets">;

/** Historial de metas (la vigente marcada; las futuras como programadas). */
export function TargetHistory({
  rows,
  activeId,
  today,
  creatorLabel,
}: {
  rows: Row[];
  activeId: string | null;
  today: string;
  creatorLabel: (row: Row) => string | null;
}) {
  if (rows.length === 0) {
    return <EmptyState icon={History} title="Sin historial todavía" description="Cada vez que cambie tu meta, aparecerá aquí." />;
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {rows.map((row) => {
        const future = row.effective_from > today;
        const by = creatorLabel(row);
        return (
          <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium" data-numeric="">
                {formatKcal(row.energy_kcal)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  P {row.protein_g} · C {row.carbs_g} · G {row.fat_g} g
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                Desde {formatShortDate(row.effective_from)} · {targetSourceLabel(row.source)}
                {by ? ` · ${by}` : ""}
              </p>
            </div>
            {row.id === activeId ? <Badge>Vigente</Badge> : future ? <Badge variant="outline">Programada</Badge> : null}
          </li>
        );
      })}
    </ol>
  );
}
