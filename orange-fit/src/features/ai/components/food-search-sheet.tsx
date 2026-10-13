"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search, SearchX } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import { provenanceLabel } from "@/lib/foods/types";
import { formatNumber } from "@/lib/format";
import { AiApiError, searchFoodsRequest } from "../lib/api-client";

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Enlace para crear un alimento propio. Se abre en otra pestaña para no perder el análisis. */
export function createFoodHref(name: string): string {
  const params = new URLSearchParams();
  if (name.trim()) params.set("nombre", name.trim().slice(0, 80));
  return `/app/alimentos/nuevo${params.size ? `?${params.toString()}` : ""}`;
}

export function CreateFoodLink({ name, variant = "outline" }: { name: string; variant?: "outline" | "link" }) {
  return (
    <Button asChild variant={variant} size="sm">
      <a href={createFoodHref(name)} target="_blank" rel="noopener">
        <ExternalLink aria-hidden="true" />
        Crear alimento
        <span className="sr-only"> (se abre en otra pestaña)</span>
      </a>
    </Button>
  );
}

type FoodSearchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Texto inicial (lo que propuso la IA). */
  initialQuery: string;
  title: string;
  onPick: (food: FoodWithPortions) => void;
};

/** Hoja inferior para buscar en la base (GET /api/foods/search) y elegir un alimento. */
export function FoodSearchSheet({ open, onOpenChange, initialQuery, title, onPick }: FoodSearchSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        {open ? <SheetBody key={initialQuery} initialQuery={initialQuery} title={title} onPick={onPick} /> : null}
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SheetBody({ initialQuery, title, onPick }: Pick<FoodSearchSheetProps, "initialQuery" | "title" | "onPick">) {
  const id = React.useId();
  const [query, setQuery] = React.useState(initialQuery);
  const q = useDebounced(query.trim());
  const search = useQuery({
    queryKey: ["ai-food-search", q],
    queryFn: ({ signal }) => searchFoodsRequest(q, signal),
    enabled: q.length >= 2,
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof AiApiError && [401, 429].includes(error.status)) && count < 1,
  });

  return (
    <>
      <BottomSheetHeader>
        <BottomSheetTitle>{title}</BottomSheetTitle>
        <BottomSheetDescription>Elige el alimento de la base: sus valores tienen procedencia.</BottomSheetDescription>
      </BottomSheetHeader>
      <div className="grid gap-3 px-5 pb-4">
        <div className="relative">
          <label htmlFor={id} className="sr-only">
            Buscar alimento
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id={id}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12"
            placeholder="Arroz, pollo, palta…"
          />
        </div>
        <section aria-label="Resultados" aria-busy={search.isFetching || undefined} className="grid gap-2">
          {q.length < 2 ? (
            <p className="text-sm text-muted-foreground">Escribe al menos 2 letras.</p>
          ) : search.isPending ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)
          ) : search.isError ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos buscar</AlertTitle>
              <AlertDescription>
                <p>{search.error instanceof AiApiError ? search.error.message : "Inténtalo de nuevo."}</p>
                <Button variant="outline" size="sm" onClick={() => search.refetch()}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          ) : search.data.length === 0 ? (
            <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-center">
              <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-semibold">No encontramos «{q}»</p>
              <p className="text-sm text-muted-foreground">Prueba con otra palabra o crea el alimento con los datos de su etiqueta.</p>
              <CreateFoodLink name={q} />
            </div>
          ) : (
            <ul className="grid gap-2">
              <li className="sr-only" role="status">
                {search.data.length} resultados
              </li>
              {search.data.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => onPick(food)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{food.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {food.brandName ? `${food.brandName} · ` : ""}
                        {provenanceLabel(food)}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatNumber(food.per100g.energyKcal)} kcal/100 g</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
