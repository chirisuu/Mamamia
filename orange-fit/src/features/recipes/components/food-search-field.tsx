"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { provenanceLabel } from "@/lib/foods/types";
import { formatNumber } from "@/lib/format";
import { FoodApiError, searchFoodsApi, type FoodSearchResult } from "../lib/food-api";

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Buscador de alimentos contra `GET /api/foods/search` (contrato 1). Muestra kcal por 100 g y la
 * procedencia; estados de carga, vacío y error reales.
 */
export function FoodSearchField({
  onSelect,
  label = "Buscar alimento",
  placeholder = "Ej.: pechuga de pollo, arroz, palta",
  autoFocus = false,
}: {
  onSelect: (food: FoodSearchResult) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const id = React.useId();
  const [q, setQ] = React.useState("");
  const term = useDebounced(q.trim(), 250);
  const enabled = term.length >= 2;
  const query = useQuery({
    queryKey: ["foods-search", term],
    queryFn: ({ signal }) => searchFoodsApi(term, signal),
    enabled,
    staleTime: 60_000,
    retry: (count, error) => !(error instanceof FoodApiError && [401, 429, 503].includes(error.status)) && count < 1,
  });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={id}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="pl-11"
          autoComplete="off"
          autoFocus={autoFocus}
        />
      </div>
      <div aria-live="polite" aria-busy={query.isFetching || undefined}>
        {!enabled ? (
          q.trim().length > 0 ? <p className="text-sm text-muted-foreground">Escribe al menos 2 letras.</p> : null
        ) : query.isPending ? (
          <div className="flex flex-col gap-2" aria-label="Buscando">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{query.error instanceof FoodApiError ? query.error.message : "No pudimos buscar alimentos."}</p>
              <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => query.refetch()}>
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No encontramos “{term}”. Prueba con otra palabra o crea el alimento en Mis alimentos.</p>
        ) : (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-label="Resultados">
            {query.data.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(f);
                    setQ("");
                  }}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {f.name}
                      {f.brandName ? <span className="font-normal text-muted-foreground"> · {f.brandName}</span> : null}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {formatNumber(f.per100g.energyKcal)} kcal · {formatNumber(f.per100g.proteinG, 1)} g proteína por 100 g · {provenanceLabel(f)}
                    </span>
                  </span>
                  <Plus className="size-5 shrink-0 text-primary-strong" aria-hidden="true" />
                  <span className="sr-only">Agregar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
