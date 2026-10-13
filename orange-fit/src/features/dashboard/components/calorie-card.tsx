import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BudgetBreakdown } from "../lib/budget";

/**
 * Anillo calórico con el desglose visible: meta base, ejercicio (solo si el perfil lo suma),
 * ajustes y consumido. Así no hay doble conteo y el usuario ve de dónde sale cada número.
 */
export function CalorieCard({ budget, consumedKcal }: { budget: BudgetBreakdown | null; consumedKcal: number }) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h2">Calorías de hoy</CardTitle>
        <CardDescription>{budget ? "Tu presupuesto del día y cuánto llevas" : "Aún no hay una meta diaria definida"}</CardDescription>
      </CardHeader>
      <CardContent className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
        <ProgressRing
          className="mx-auto"
          consumed={consumedKcal}
          goal={budget?.budget.total ?? null}
          label="Calorías de hoy"
          size={208}
        />
        {budget ? (
          <div className="grid gap-3">
            <dl className="grid gap-1.5 text-sm" data-numeric="">
              {budget.rows.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "flex items-baseline justify-between gap-3",
                    row.key === "remaining" && "border-t border-border pt-2 font-semibold",
                  )}
                >
                  <dt className={cn(row.key === "remaining" ? "text-foreground" : "text-muted-foreground")}>
                    {row.label}
                    {row.note ? <span className="block text-xs font-normal text-muted-foreground">{row.note}</span> : null}
                  </dt>
                  <dd className="shrink-0 text-foreground">
                    {row.key === "base" || row.key === "remaining" ? "" : row.value === 0 ? "" : `${row.sign} `}
                    {formatNumber(Math.abs(row.value))} kcal
                  </dd>
                </div>
              ))}
            </dl>
            <details className="group text-sm">
              <summary className="min-h-11 cursor-pointer list-none rounded-lg py-2 font-medium text-primary-strong outline-none focus-visible:ring-2 focus-visible:ring-ring">
                ¿Cómo se calcula?
              </summary>
              <ul className="grid gap-1.5 text-muted-foreground">
                {budget.budget.explanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {!budget.countExercise ? (
                  <li>
                    Si prefieres sumar tu ejercicio a la meta, actívalo en{" "}
                    <Link href="/app/perfil/metas" className="font-medium text-primary-strong underline-offset-4 hover:underline">
                      tus metas
                    </Link>
                    .
                  </li>
                ) : null}
              </ul>
            </details>
          </div>
        ) : (
          <div className="grid gap-2 text-sm">
            <p className="text-muted-foreground">
              Para mostrarte cuánto te queda necesitamos tu meta diaria. Puedes definirla en un minuto.
            </p>
            <Link
              href="/app/perfil/metas"
              className="inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline"
            >
              Definir mi meta
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
