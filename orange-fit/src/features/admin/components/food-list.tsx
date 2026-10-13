import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { FOOD_SOURCE_LABELS, VERIFICATION_LABELS } from "../lib/labels";
import type { AdminFoodListItem } from "../server/foods";

const STATUS_BADGE = { unverified: "outline", curated: "soft", verified: "success", rejected: "destructive" } as const;

/** Fila de alimento del catálogo (nombre, marca, macros por 100 g, fuente y estado). */
export function FoodRowSummary({ food }: { food: AdminFoodListItem }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <p className="truncate font-medium">
        {food.name}
        {food.brandName ? <span className="font-normal text-muted-foreground"> · {food.brandName}</span> : null}
      </p>
      <p className="text-xs text-muted-foreground" data-numeric="">
        {formatNumber(Number(food.energy_kcal))} kcal · P {formatNumber(Number(food.protein_g), 1)} g · C {formatNumber(Number(food.carbs_g), 1)} g · G{" "}
        {formatNumber(Number(food.fat_g), 1)} g por 100 g{food.barcode ? ` · ${food.barcode}` : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={STATUS_BADGE[food.verification_status]}>{VERIFICATION_LABELS[food.verification_status]}</Badge>
        <Badge variant="secondary">{FOOD_SOURCE_LABELS[food.source]}</Badge>
        {!food.is_public ? <Badge variant="outline">Fuera del catálogo</Badge> : null}
      </div>
    </div>
  );
}

export function FoodList({ foods }: { foods: AdminFoodListItem[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {foods.map((food) => (
        <li key={food.id}>
          <Link
            href={`/admin/alimentos/${food.id}`}
            className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <FoodRowSummary food={food} />
            <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Editar</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
