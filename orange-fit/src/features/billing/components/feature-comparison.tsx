import { Check, Minus } from "lucide-react";
import type { PlanCard } from "../catalog-view";

/**
 * Tabla Gratis vs Premium. Las filas salen de `plans.features` (con FEATURE_LABELS para las de pago)
 * y de los límites de IA de cada plan. Cada celda dice "Incluido"/"No incluido" para lectores de pantalla.
 */
export function FeatureComparison({ free, premium }: { free: PlanCard; premium: PlanCard }) {
  const rows = new Map<string, { label: string; free: boolean; premium: boolean }>();
  for (const f of free.features) rows.set(f.code, { label: f.label, free: true, premium: false });
  for (const f of premium.features) {
    const row = rows.get(f.code);
    if (row) row.premium = true;
    else rows.set(f.code, { label: f.label, free: false, premium: true });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Qué incluye cada plan</caption>
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th scope="col" className="px-4 py-3 font-semibold">
              Función
            </th>
            <th scope="col" className="w-20 px-2 py-3 text-center font-semibold sm:w-28">
              {free.name}
            </th>
            <th scope="col" className="w-20 px-2 py-3 text-center font-semibold sm:w-28">
              {premium.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {[...rows.values()].map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-3 font-normal">
                {row.label}
              </th>
              <Cell included={row.free} />
              <Cell included={row.premium} />
            </tr>
          ))}
          {premium.aiLimits.length > 0 ? (
            <tr className="border-t border-border">
              <th scope="row" className="px-4 py-3 align-top font-normal">
                Cupo mensual de IA
                <span className="mt-1 block text-xs text-muted-foreground">{premium.aiLimits.join(" · ")}</span>
              </th>
              <td className="px-2 py-3 text-center align-top text-muted-foreground">
                {free.aiLimits.length > 0 ? free.aiLimits.join(" · ") : <IncludedIcon included={false} />}
              </td>
              <td className="px-2 py-3 text-center align-top">
                <IncludedIcon included />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ included }: { included: boolean }) {
  return (
    <td className="px-2 py-3 text-center">
      <IncludedIcon included={included} />
    </td>
  );
}

function IncludedIcon({ included }: { included: boolean }) {
  return included ? (
    <>
      <Check className="mx-auto size-5 text-primary-strong" aria-hidden="true" />
      <span className="sr-only">Incluido</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">No incluido</span>
    </>
  );
}
