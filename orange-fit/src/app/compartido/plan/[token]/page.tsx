import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { getAppSettings } from "@/lib/config/app-settings";
import { isSupabaseConfigured } from "@/lib/env";
import { addDays } from "@/lib/dates";
import { formatNumber, formatShortDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSharedPlan, SHARE_TOKEN_PATTERN } from "@/features/planner/lib/shared";

export const metadata: Metadata = {
  title: "Plan compartido",
  // Enlaces privados por token: no se indexan ni se envía el token a otros sitios.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Plan compartido por enlace (sin sesión). Solo se ven las comidas: `get_shared_plan` no devuelve
 * nombre, correo, metas ni ids. Si el enlace se desactivó, la página no existe.
 */
export default async function SharedPlanPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!SHARE_TOKEN_PATTERN.test(token) || !isSupabaseConfigured()) notFound();
  const [{ appName }, supabase] = await Promise.all([getAppSettings(), createSupabaseServerClient()]);
  const { data, error } = await supabase.rpc("get_shared_plan", { token });
  if (error) throw new Error("get_shared_plan");
  const plan = parseSharedPlan(data);
  if (!plan) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/80 pt-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo appName={appName} />
          </Link>
          <Button asChild size="sm" variant="outline">
            <Link href="/registro">Crear mi cuenta</Link>
          </Button>
        </div>
      </header>
      <main id="contenido" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-safe-8 pt-6">
        <div>
          <p className="text-sm font-medium text-primary-strong">Plan de comidas compartido</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{plan.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Del {formatShortDate(plan.startDate)} al {formatShortDate(addDays(plan.startDate, plan.days - 1))}. Calorías y macros calculados desde
            los ingredientes de cada receta.
          </p>
        </div>

        {plan.dayList.map((day) => (
          <section key={day.dayIndex} aria-labelledby={`dia-${day.dayIndex}`} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`dia-${day.dayIndex}`} className="text-base font-semibold">
                {day.label}
              </h2>
              <p className="text-sm text-muted-foreground tabular-nums">
                {formatNumber(day.totals.kcal)} kcal · {formatNumber(day.totals.proteinG)} g proteína
              </p>
            </div>
            {day.meals.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sin comidas para este día.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-border">
                {day.meals.map((m, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{m.mealLabel}</p>
                      <p className="font-medium">{m.title}</p>
                      {m.amount ? <p className="text-xs text-muted-foreground">{m.amount}</p> : null}
                    </div>
                    <p className="shrink-0 text-right text-sm tabular-nums">
                      {formatNumber(m.kcal)} kcal
                      <span className="block text-xs text-muted-foreground">
                        P {formatNumber(m.proteinG)} · C {formatNumber(m.carbsG)} · G {formatNumber(m.fatG)}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <p className="text-xs text-muted-foreground">
          Este plan es una guía general compartida por un usuario de {appName}. No reemplaza la indicación de un profesional de la salud. Las
          porciones están pensadas para la meta de quien lo compartió.
        </p>
      </main>
    </div>
  );
}
