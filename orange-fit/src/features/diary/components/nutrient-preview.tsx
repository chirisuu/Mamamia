import { formatGrams, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Nutrients = {
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
};

/** Vista previa de nutrientes de una cantidad (calculada desde la base, no estimada en el cliente). */
export function NutrientPreview({ nutrients, grams, className }: { nutrients: Nutrients; grams: number | null; className?: string }) {
  const macros = [
    { key: "protein", label: "Proteína", value: nutrients.proteinG, dot: "bg-macro-protein" },
    { key: "carbs", label: "Carbos", value: nutrients.carbsG, dot: "bg-macro-carbs" },
    { key: "fat", label: "Grasas", value: nutrients.fatG, dot: "bg-macro-fat" },
  ];
  const extras = [
    nutrients.fiberG != null ? `Fibra ${formatGrams(nutrients.fiberG, 1)}` : null,
    nutrients.sugarG != null ? `Azúcar ${formatGrams(nutrients.sugarG, 1)}` : null,
    nutrients.sodiumMg != null ? `Sodio ${formatNumber(nutrients.sodiumMg)} mg` : null,
  ].filter(Boolean);
  return (
    <div className={cn("rounded-2xl bg-muted/60 p-4", className)} aria-live="polite">
      <div className="flex items-baseline justify-between gap-3" data-numeric="">
        <p className="text-3xl font-semibold tracking-tight">
          {formatNumber(nutrients.energyKcal)} <span className="text-base font-medium text-muted-foreground">kcal</span>
        </p>
        {grams != null ? <p className="text-sm text-muted-foreground">{formatGrams(grams, grams % 1 ? 1 : 0)}</p> : null}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm" data-numeric="">
        {macros.map((m) => (
          <div key={m.key} className="flex flex-col">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 rounded-full", m.dot)} />
              {m.label}
            </dt>
            <dd className="font-semibold">{formatGrams(m.value, 1)}</dd>
          </div>
        ))}
      </dl>
      {extras.length ? <p className="mt-2 text-xs text-muted-foreground">{extras.join(" · ")}</p> : null}
    </div>
  );
}
