import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Piezas de servidor del panel: select nativo (funciona en formularios GET sin JavaScript),
 * barra de filtros, paginación por URL y sub-navegación de secciones.
 */

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative min-w-0">
      <select className={cn(inputBase, "h-12 appearance-none px-4 pr-10", className)} {...props} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

export function Field({ label, htmlFor, children, hint, className }: { label: string; htmlFor: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Formulario GET de filtros: el estado vive en la URL (se puede compartir y recargar). */
export function FilterBar({ action, children, clearHref, className }: { action: string; children: React.ReactNode; clearHref?: string; className?: string }) {
  return (
    <form method="get" action={action} role="search" className={cn("grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-end", className)}>
      {children}
      <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
        <Button type="submit" variant="secondary" className="flex-1">
          Filtrar
        </Button>
        {clearHref ? (
          <Button asChild variant="ghost">
            <Link href={clearHref}>Limpiar</Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function buildHref(basePath: string, params: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({
  page,
  total,
  perPage,
  basePath,
  params,
}: {
  page: number;
  total: number;
  perPage: number;
  basePath: string;
  params: Record<string, string | number | null | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (pages <= 1) return null;
  const prev = page > 1 ? buildHref(basePath, { ...params, page: page - 1 === 1 ? null : page - 1 }) : null;
  const next = page < pages ? buildHref(basePath, { ...params, page: page + 1 }) : null;
  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-3">
      {prev ? (
        <Button asChild variant="outline" size="sm">
          <Link href={prev} rel="prev">
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground" data-numeric="">
        Página {page} de {pages}
      </p>
      {next ? (
        <Button asChild variant="outline" size="sm">
          <Link href={next} rel="next">
            Siguiente
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function SubNav({ items, current, label }: { items: ReadonlyArray<{ href: string; label: string; count?: number | null }>; current: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl bg-secondary p-1">
        {items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-medium text-muted-foreground outline-none transition-colors",
                  "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  active && "bg-card font-semibold text-foreground shadow-sm",
                )}
              >
                {item.label}
                {item.count ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground" data-numeric="">
                    {item.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Página como número desde searchParams (1 por defecto, tope razonable). */
export function pageParam(value: string | string[] | undefined): number {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 10_000 ? n : 1;
}

export function stringParam(value: string | string[] | undefined, max = 120): string | null {
  const v = (Array.isArray(value) ? value[0] : value)?.trim();
  return v ? v.slice(0, max) : null;
}

export function enumParam<T extends string>(value: string | string[] | undefined, allowed: readonly T[]): T | null {
  const v = Array.isArray(value) ? value[0] : value;
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : null;
}

/** "13 oct 2026, 14:05" en hora de Lima. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d
    .toLocaleString("es-PE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" })
    .replace(/\./g, "");
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" }).replace(/\./g, "");
}
