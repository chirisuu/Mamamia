import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Camera, ChefHat, Droplet, Mic, NotebookPen, ScanBarcode, Search, Timer, Type, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { ManualEntryDialog } from "@/features/diary/components/manual-entry-dialog";
import { mealLabel } from "@/features/diary/lib/day-totals";
import { logTargetQuery, resolveLogTarget } from "@/features/diary/lib/log-target";
import { MEAL_SECTION_LABELS, STANDARD_MEALS } from "@/features/diary/lib/meal-time";
import { getDiaryPageContext } from "@/features/diary/server/page-context";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Registrar" };

type Method = { href: string; label: string; description: string; icon: LucideIcon };

export default async function AddIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await getDiaryPageContext("/app/agregar");
  const target = resolveLogTarget(await searchParams, ctx.today, ctx.hour);
  const query = logTargetQuery(target);
  const dayLabel = target.isToday ? "hoy" : formatShortDate(target.localDate);
  const name = mealLabel(target.mealType, target.customName);

  // Los mismos accesos del botón "+", con la fecha y la comida elegidas.
  const methods: Method[] = [
    { href: `/app/agregar/buscar?${query}`, label: "Buscar alimento", description: "En la base de alimentos", icon: Search },
    { href: `/app/agregar/codigo?${query}`, label: "Código de barras", description: "Escanea un envase", icon: ScanBarcode },
    { href: `/app/agregar/foto?${query}`, label: "Foto", description: "La IA sugiere, tú confirmas", icon: Camera },
    { href: `/app/agregar/voz?${query}`, label: "Voz", description: "Dicta lo que comiste", icon: Mic },
    { href: `/app/agregar/texto?${query}`, label: "Texto", description: "Descríbelo con tus palabras", icon: Type },
    { href: "/app/recetas", label: "Receta", description: "De tus recetas o las nuestras", icon: ChefHat },
  ];
  const others: Method[] = [
    { href: "/app/agua", label: "Agua", description: "Suma lo que tomaste", icon: Droplet },
    { href: "/app/actividad", label: "Actividad", description: "Registra tu ejercicio", icon: Activity },
    { href: "/app/ayuno", label: "Ayuno", description: "Controla tu ventana", icon: Timer },
    { href: "/app/alimentos", label: "Mis alimentos", description: "Crea y edita los tuyos", icon: UtensilsCrossed },
  ];

  return (
    <>
      <AppHeader title="Registrar" subtitle={`${name} · ${dayLabel}`} backHref={`/app/diario/${target.localDate}`} backLabel="Ir al diario" />

      <nav aria-label="Comida" className="-mx-4 overflow-x-auto px-4 pb-1 pt-2 scrollbar-none">
        <ul className="flex gap-2">
          {STANDARD_MEALS.map((m) => {
            const active = target.mealType === m;
            return (
              <li key={m}>
                <Link
                  href={`/app/agregar?${logTargetQuery({ ...target, mealType: m, customName: null })}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {MEAL_SECTION_LABELS[m]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="metodos" className="mt-4">
        <h2 id="metodos" className="mb-3 text-base font-semibold">
          ¿Cómo quieres agregarlo?
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methods.map((m) => (
            <li key={m.label}>
              <MethodLink method={m} />
            </li>
          ))}
          <li>
            <ManualEntryDialog localDate={target.localDate} mealType={target.mealType} customName={target.customName} mealName={name} />
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Lo que sugiere la IA (foto, voz o texto) nunca se guarda sin que lo confirmes.
        </p>
      </section>

      <section aria-labelledby="otros" className="mt-8">
        <h2 id="otros" className="mb-3 text-base font-semibold">
          También puedes registrar
        </h2>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {others.map((m) => (
            <li key={m.label}>
              <MethodLink method={m} />
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8">
        <Link
          href={`/app/diario/${target.localDate}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <NotebookPen className="size-4" aria-hidden="true" />
          Ver el diario de {dayLabel}
        </Link>
      </div>
    </>
  );
}

function MethodLink({ method }: { method: Method }) {
  const Icon = method.icon;
  return (
    <Link
      href={method.href}
      className={cn(
        "flex h-full min-h-24 flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left",
        "transition-colors duration-150 hover:border-primary/50 hover:bg-accent/50",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-strong">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-foreground">{method.label}</span>
        <span className="text-xs text-muted-foreground">{method.description}</span>
      </span>
    </Link>
  );
}
