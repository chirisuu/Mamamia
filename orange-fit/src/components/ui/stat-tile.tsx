import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatTileProps = Omit<React.ComponentProps<"div">, "children"> & {
  label: string;
  /** Valor ya formateado (usa src/lib/format.ts). null/undefined se muestra como "—". */
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  /** Línea secundaria: meta, variación, fecha. */
  hint?: React.ReactNode;
  tone?: "default" | "primary";
};

/** Métrica compacta (agua, pasos, peso, racha). */
function StatTile({ label, value, unit, icon: Icon, hint, tone = "default", className, ...props }: StatTileProps) {
  const empty = value == null || value === "";
  return (
    <div
      data-slot="stat-tile"
      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm", className)}
      {...props}
    >
      <div className="flex items-center gap-2.5">
        {Icon ? (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl",
              tone === "primary" ? "bg-primary text-primary-foreground" : "bg-accent text-primary-strong",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        ) : null}
        <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="flex items-baseline gap-1" data-numeric="">
        <span className="text-2xl font-semibold tracking-tight">{empty ? "—" : value}</span>
        {unit && !empty ? <span className="text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export { StatTile, type StatTileProps };
