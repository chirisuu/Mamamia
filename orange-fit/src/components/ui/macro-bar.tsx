import * as React from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type Macro = "protein" | "carbs" | "fat" | "fiber";

/**
 * Metadatos de cada macro. Las clases van escritas completas para que Tailwind las detecte.
 * Los colores de macro son para gráficos (≥ 3:1); el texto se mantiene en foreground/muted.
 */
const MACROS: Record<Macro, { label: string; bg: string; text: string; stroke: string; fill: string }> = {
  protein: {
    label: "Proteína",
    bg: "bg-macro-protein",
    text: "text-macro-protein",
    stroke: "stroke-macro-protein",
    fill: "fill-macro-protein",
  },
  carbs: {
    label: "Carbohidratos",
    bg: "bg-macro-carbs",
    text: "text-macro-carbs",
    stroke: "stroke-macro-carbs",
    fill: "fill-macro-carbs",
  },
  fat: { label: "Grasas", bg: "bg-macro-fat", text: "text-macro-fat", stroke: "stroke-macro-fat", fill: "fill-macro-fat" },
  fiber: {
    label: "Fibra",
    bg: "bg-macro-fiber",
    text: "text-macro-fiber",
    stroke: "stroke-macro-fiber",
    fill: "fill-macro-fiber",
  },
};

type MacroBarProps = Omit<React.ComponentProps<"div">, "children"> & {
  macro: Macro;
  consumed: number;
  goal: number | null | undefined;
  unit?: string;
  /** Sobrescribe el nombre ("Proteína"). */
  label?: string;
};

/** Barra de un macronutriente: consumido / meta. Pasarse se indica en texto neutro, sin rojo. */
function MacroBar({ macro, consumed, goal, unit = "g", label, className, ...props }: MacroBarProps) {
  const meta = MACROS[macro];
  const name = label ?? meta.label;
  const safeConsumed = Number.isFinite(consumed) ? Math.max(0, consumed) : 0;
  const hasGoal = goal != null && Number.isFinite(goal) && goal > 0;
  const g = hasGoal ? (goal as number) : 0;
  const pct = hasGoal ? Math.min(safeConsumed / g, 1) * 100 : 0;
  const over = hasGoal && safeConsumed > g;
  const valueText = hasGoal
    ? `${formatNumber(safeConsumed)} de ${formatNumber(g)} ${unit}`
    : `${formatNumber(safeConsumed)} ${unit}, sin meta definida`;

  return (
    <div data-slot="macro-bar" data-macro={macro} className={cn("flex flex-col gap-1.5", className)} {...props}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-medium text-foreground">
          <span aria-hidden="true" className={cn("size-2.5 rounded-full", meta.bg)} />
          {name}
        </span>
        <span className="text-muted-foreground" data-numeric="">
          <span className="font-semibold text-foreground">{formatNumber(safeConsumed)}</span>
          {hasGoal ? ` / ${formatNumber(g)}` : ""} {unit}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={hasGoal ? g : undefined}
        aria-valuenow={hasGoal ? Math.min(safeConsumed, g) : undefined}
        aria-valuetext={valueText}
        className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-200 ease-out", meta.bg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over ? (
        <p className="text-xs text-muted-foreground" data-numeric="">
          {formatNumber(safeConsumed - g)} {unit} sobre la meta
        </p>
      ) : null}
    </div>
  );
}

export { MacroBar, MACROS, type Macro, type MacroBarProps };
