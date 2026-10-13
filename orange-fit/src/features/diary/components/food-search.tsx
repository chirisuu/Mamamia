"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Plus, RotateCcw, Search, SearchX, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toPickerFood, type ApiFood } from "../lib/picker-food";
import type { MealOption, MealType, PickerFood } from "../types";
import { PortionPicker } from "./portion-picker";

type RecentFood = PickerFood & { lastGrams: number | null; lastQuantity: number | null; lastUnit: string | null };

export type FoodSearchProps = {
  localDate: string;
  maxDate: string;
  defaultMeal: MealType;
  defaultCustomName: string | null;
  mealOptions: MealOption[];
  recent: RecentFood[];
  favorites: PickerFood[];
  initialQuery?: string;
  /** Error al cargar recientes/favoritos en el servidor. */
  listsError?: boolean;
};

class SearchError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function fetchFoods(q: string, signal: AbortSignal): Promise<ApiFood[]> {
  const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}&limit=20`, {
    signal,
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    let message = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? "";
    } catch {
      // Respuesta sin JSON: se usa el mensaje genérico.
    }
    throw new SearchError(res.status, message);
  }
  const body = (await res.json()) as { foods?: ApiFood[] };
  return body.foods ?? [];
}

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function errorCopy(error: unknown): { title: string; body: string; retry: boolean; login?: boolean } {
  const status = error instanceof SearchError ? error.status : 0;
  if (status === 401) return { title: "Tu sesión expiró", body: "Vuelve a ingresar para seguir buscando.", retry: false, login: true };
  if (status === 429) {
    return { title: "Muchas búsquedas seguidas", body: "Espera unos segundos y vuelve a intentarlo.", retry: true };
  }
  if (status === 503) {
    return { title: "La búsqueda no está disponible", body: (error as SearchError).message || "El servicio no está configurado.", retry: true };
  }
  return { title: "No pudimos buscar", body: "Revisa tu conexión e inténtalo de nuevo.", retry: true };
}

/**
 * Buscador en vivo contra GET /api/foods/search (TanStack Query), con recientes y favoritos.
 * Al elegir un alimento se abre el PortionPicker.
 */
export function FoodSearch({
  localDate,
  maxDate,
  defaultMeal,
  defaultCustomName,
  mealOptions,
  recent,
  favorites,
  initialQuery = "",
  listsError,
}: FoodSearchProps) {
  const inputId = React.useId();
  const [query, setQuery] = React.useState(initialQuery);
  const q = useDebounced(query.trim());
  const [selected, setSelected] = React.useState<{ food: PickerFood; initial?: RecentFood } | null>(null);
  const [open, setOpen] = React.useState(false);
  const favoriteIds = React.useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const search = useQuery({
    queryKey: ["foods-search", q],
    queryFn: ({ signal }) => fetchFoods(q, signal),
    enabled: q.length >= 2,
    staleTime: 30_000,
    retry: (count, error) => !(error instanceof SearchError && [401, 429].includes(error.status)) && count < 1,
  });

  const choose = (food: PickerFood, initial?: RecentFood) => {
    setSelected({ food, initial });
    setOpen(true);
  };

  const createHref = `/app/alimentos/nuevo?${new URLSearchParams({
    ...(query.trim() ? { nombre: query.trim() } : {}),
    volver: `/app/agregar/buscar?fecha=${localDate}`,
  }).toString()}`;

  const showingSearch = q.length >= 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Buscar alimento
        </label>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus
          placeholder="Arroz, pollo, palta…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12"
        />
      </div>
      {query.trim().length === 1 ? <p className="text-sm text-muted-foreground">Escribe al menos 2 letras.</p> : null}

      {showingSearch ? (
        <section aria-label="Resultados" aria-busy={search.isFetching || undefined}>
          {search.isPending ? (
            <ResultsSkeleton />
          ) : search.isError ? (
            <SearchErrorView error={search.error} onRetry={() => search.refetch()} />
          ) : search.data.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={`No encontramos «${q}»`}
              description="Prueba con otra palabra o crea tu propio alimento con los datos de la etiqueta."
              action={
                <Button asChild variant="outline">
                  <Link href={createHref}>
                    <Plus aria-hidden="true" />
                    Crear alimento propio
                  </Link>
                </Button>
              }
            />
          ) : (
            <>
              <p className="sr-only" role="status">
                {search.data.length} resultados
              </p>
              <FoodList
                foods={search.data.map((f) => toPickerFood(f, f.portions ?? [], favoriteIds.has(f.id)))}
                onChoose={(f) => choose(f)}
              />
              <div className="mt-4 flex justify-center">
                <Button asChild variant="link">
                  <Link href={createHref}>¿No está? Crea tu propio alimento</Link>
                </Button>
              </div>
            </>
          )}
        </section>
      ) : (
        <Tabs defaultValue={recent.length || !favorites.length ? "recent" : "favorites"}>
          <TabsList className="w-full">
            <TabsTrigger value="recent">
              <History aria-hidden="true" />
              Recientes
            </TabsTrigger>
            <TabsTrigger value="favorites">
              <Star aria-hidden="true" />
              Favoritos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recent">
            {listsError ? (
              <ListsError />
            ) : recent.length ? (
              <FoodList foods={recent} onChoose={(f) => choose(f, recent.find((r) => r.id === f.id))} />
            ) : (
              <EmptyState
                icon={History}
                title="Aún no tienes recientes"
                description="Los alimentos que registres aparecerán aquí para agregarlos en un toque."
              />
            )}
          </TabsContent>
          <TabsContent value="favorites">
            {listsError ? (
              <ListsError />
            ) : favorites.length ? (
              <FoodList foods={favorites} onChoose={(f) => choose(f)} />
            ) : (
              <EmptyState
                icon={Star}
                title="Sin favoritos todavía"
                description="Toca la estrella de un alimento para tenerlo siempre a mano."
              />
            )}
          </TabsContent>
        </Tabs>
      )}

      <PortionPicker
        food={selected?.food ?? null}
        open={open}
        onOpenChange={setOpen}
        localDate={localDate}
        maxDate={maxDate}
        defaultMeal={defaultMeal}
        defaultCustomName={defaultCustomName}
        mealOptions={mealOptions}
        source="search"
        initial={
          selected?.initial ? { grams: selected.initial.lastGrams, quantity: selected.initial.lastQuantity, unit: selected.initial.lastUnit } : null
        }
      />
    </div>
  );
}

function FoodList({ foods, onChoose }: { foods: PickerFood[]; onChoose: (food: PickerFood) => void }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {foods.map((food) => (
        <li key={food.id}>
          <button
            type="button"
            onClick={() => onChoose(food)}
            className={cn(
              "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
              "outline-none focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{food.name}</span>
                {food.isOwn ? <Badge variant="soft">Tuyo</Badge> : null}
                {food.isFavorite ? <Star className="size-3.5 shrink-0 fill-primary stroke-primary-strong" aria-label="Favorito" /> : null}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {food.brandName ? `${food.brandName} · ` : ""}
                {food.provenance}
              </span>
            </span>
            <span className="shrink-0 text-right" data-numeric="">
              <span className="block font-semibold">{formatNumber(food.per100g.energyKcal)}</span>
              <span className="block text-xs text-muted-foreground">kcal/100 g</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ResultsSkeleton() {
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
      ))}
    </div>
  );
}

function SearchErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const copy = errorCopy(error);
  return (
    <Alert variant="destructive">
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>
        <p>{copy.body}</p>
        {copy.login ? (
          <Button asChild variant="outline" size="sm" className="mt-2">
            <Link href="/ingresar?next=/app/agregar/buscar">Ingresar</Link>
          </Button>
        ) : copy.retry ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RotateCcw aria-hidden="true" />
            Reintentar
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function ListsError() {
  return (
    <Alert variant="destructive">
      <AlertTitle>No pudimos cargar esta lista</AlertTitle>
      <AlertDescription>Recarga la página para intentarlo de nuevo. La búsqueda sigue funcionando.</AlertDescription>
    </Alert>
  );
}
