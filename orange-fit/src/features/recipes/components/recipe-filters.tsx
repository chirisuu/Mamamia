"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { formatMoney } from "@/lib/format";
import { activeFilterCount, filtersToSearchParams, RECIPE_SORT_LABELS, RECIPE_SORTS, type RecipeFilters as Filters, type RecipeSort } from "../lib/filters";
import { ALLERGEN_LABELS, ALLERGENS, DIET_FILTER_OPTIONS, DIET_TAG_LABELS, RECIPE_MEAL_TYPE_LABELS, RECIPE_MEAL_TYPES } from "../lib/labels";
import { ToggleChip } from "./toggle-chip";

const TIME_OPTIONS = [15, 30, 45, 60] as const;
const COST_OPTIONS = [3, 5, 8, 12] as const;

/**
 * Búsqueda y filtros del catálogo. El estado vive en la URL (se puede volver atrás o compartir);
 * el servidor filtra con `filterRecipes`.
 */
export function RecipeFilters({ filters, currency, resultCount }: { filters: Filters; currency: string; resultCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [q, setQ] = React.useState(filters.q);
  const [serverQ, setServerQ] = React.useState(filters.q);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Filters>(filters);
  // Última búsqueda enviada: evita que la espera de la búsqueda en vivo pise otra navegación.
  const committedQ = React.useRef(filters.q);
  // Si la URL cambia por fuera (atrás/adelante), el campo muestra lo que dice la URL.
  if (filters.q !== serverQ) {
    setServerQ(filters.q);
    setQ(filters.q);
  }

  const navigate = React.useCallback(
    (next: Filters, replace = false) => {
      committedQ.current = next.q;
      const qs = filtersToSearchParams(next).toString();
      const href = qs ? `/app/recetas?${qs}` : "/app/recetas";
      startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));
    },
    [router],
  );

  // Búsqueda en vivo con espera corta para no navegar en cada tecla.
  React.useEffect(() => {
    if (q.trim() === committedQ.current) return;
    const t = window.setTimeout(() => navigate({ ...filters, q: q.trim() }, true), 300);
    return () => window.clearTimeout(t);
  }, [q, filters, navigate]);

  const count = activeFilterCount(filters);
  const toggle = <T extends string>(list: readonly T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="flex flex-col gap-3" aria-busy={pending || undefined}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Label htmlFor="recipe-search" className="sr-only">
            Buscar recetas
          </Label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="recipe-search"
            type="search"
            inputMode="search"
            placeholder="Buscar: pollo, quinua, desayuno…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-11"
            autoComplete="off"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(filters);
            setOpen(true);
          }}
          aria-label={count ? `Filtros (${count} activos)` : "Filtros"}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {count ? (
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground" aria-hidden="true">
              {count}
            </span>
          ) : null}
        </Button>
      </div>

      <nav aria-label="Tipo de comida" className="-mx-4 overflow-x-auto px-4 scrollbar-none lg:mx-0 lg:px-0">
        <div className="flex gap-2">
          <ToggleChip pressed={filters.mealType === null} onPressedChange={() => navigate({ ...filters, mealType: null })}>
            Todas
          </ToggleChip>
          {RECIPE_MEAL_TYPES.map((m) => (
            <ToggleChip key={m} pressed={filters.mealType === m} onPressedChange={(on) => navigate({ ...filters, mealType: on ? m : null })}>
              {RECIPE_MEAL_TYPE_LABELS[m]}
            </ToggleChip>
          ))}
        </div>
      </nav>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" role="status">
        <span>
          {resultCount === 1 ? "1 receta" : `${resultCount} recetas`}
          {filters.excludeAllergens.length ? ` · sin ${filters.excludeAllergens.map((a) => ALLERGEN_LABELS[a].toLowerCase()).join(", ")}` : ""}
          {filters.allergensFromGoal ? " (según tu objetivo)" : ""}
        </span>
        {count > 0 || filters.q ? (
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={() => {
              setQ("");
              navigate({ ...filters, q: "", mealType: null, diet: [], excludeAllergens: [], allergensFromGoal: false, maxMinutes: null, maxCost: null, favorites: false, mine: false });
            }}
          >
            <X aria-hidden="true" className="size-4" />
            Quitar filtros
          </Button>
        ) : null}
      </div>

      <BottomSheet open={open} onOpenChange={setOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Filtros</BottomSheetTitle>
            <BottomSheetDescription>Ver recetas es gratis. Ajusta lo que necesites.</BottomSheetDescription>
          </BottomSheetHeader>
          <div className="flex flex-col gap-6 px-5 py-2">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Dieta</legend>
              <div className="flex flex-wrap gap-2">
                {DIET_FILTER_OPTIONS.map((t) => (
                  <ToggleChip key={t} pressed={draft.diet.includes(t)} onPressedChange={() => setDraft({ ...draft, diet: toggle(draft.diet, t) })}>
                    {DIET_TAG_LABELS[t]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Sin estos alérgenos</legend>
              <p className="text-xs text-muted-foreground">Por defecto marcamos los de tu objetivo. Revisa siempre los ingredientes.</p>
              <div className="flex flex-wrap gap-2">
                {ALLERGENS.map((a) => (
                  <ToggleChip
                    key={a}
                    pressed={draft.excludeAllergens.includes(a)}
                    onPressedChange={() => setDraft({ ...draft, excludeAllergens: toggle(draft.excludeAllergens, a), allergensFromGoal: false })}
                  >
                    {ALLERGEN_LABELS[a]}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Tiempo total máximo</legend>
              <div className="flex flex-wrap gap-2">
                <ToggleChip pressed={draft.maxMinutes == null} onPressedChange={() => setDraft({ ...draft, maxMinutes: null })}>
                  Sin límite
                </ToggleChip>
                {TIME_OPTIONS.map((m) => (
                  <ToggleChip key={m} pressed={draft.maxMinutes === m} onPressedChange={(on) => setDraft({ ...draft, maxMinutes: on ? m : null })}>
                    {m} min
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Costo máximo por porción</legend>
              <p className="text-xs text-muted-foreground">Precios referenciales, no en tiempo real.</p>
              <div className="flex flex-wrap gap-2">
                <ToggleChip pressed={draft.maxCost == null} onPressedChange={() => setDraft({ ...draft, maxCost: null })}>
                  Sin límite
                </ToggleChip>
                {COST_OPTIONS.map((c) => (
                  <ToggleChip key={c} pressed={draft.maxCost === c} onPressedChange={(on) => setDraft({ ...draft, maxCost: on ? c : null })}>
                    {formatMoney(c, currency)}
                  </ToggleChip>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="only-favorites">Solo mis favoritas</Label>
                <Switch id="only-favorites" checked={draft.favorites} onCheckedChange={(v) => setDraft({ ...draft, favorites: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="only-mine">Solo mis recetas</Label>
                <Switch id="only-mine" checked={draft.mine} onCheckedChange={(v) => setDraft({ ...draft, mine: v })} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="recipe-sort">Ordenar por</Label>
              <Select value={draft.sort} onValueChange={(v) => setDraft({ ...draft, sort: v as RecipeSort })}>
                <SelectTrigger id="recipe-sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPE_SORTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RECIPE_SORT_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <BottomSheetFooter className="pb-2">
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate({ ...draft, q: q.trim() });
              }}
            >
              Ver resultados
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDraft({ ...draft, diet: [], excludeAllergens: [], allergensFromGoal: false, maxMinutes: null, maxCost: null, favorites: false, mine: false, sort: "nombre" })}
            >
              Limpiar filtros
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
