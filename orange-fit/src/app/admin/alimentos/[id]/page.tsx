import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/features/admin/components/admin-ui";
import { FoodForm } from "@/features/admin/components/food-form";
import { FOOD_SOURCE_LABELS, VERIFICATION_LABELS } from "@/features/admin/lib/labels";
import type { FoodInput } from "@/features/admin/schemas";
import { getFoodForEdit, type AdminFoodDetail } from "@/features/admin/server/foods";

export const metadata: Metadata = { title: "Editar alimento" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: number | null) => (v == null ? null : Number(v));

function toInput(food: AdminFoodDetail): FoodInput {
  return {
    id: food.id,
    name: food.name,
    brandName: food.brandName ?? "",
    description: food.description ?? "",
    foodType: (["generic", "branded", "dish"] as const).find((t) => t === food.food_type) ?? "generic",
    barcode: food.barcode ?? "",
    countryCodes: food.country_codes ?? [],
    energyKcal: Number(food.energy_kcal),
    proteinG: Number(food.protein_g),
    carbsG: Number(food.carbs_g),
    fatG: Number(food.fat_g),
    fiberG: n(food.fiber_g),
    sugarG: n(food.sugar_g),
    saturatedFatG: n(food.saturated_fat_g),
    sodiumMg: n(food.sodium_mg),
    densityGPerMl: n(food.density_g_per_ml),
    // Un alimento retirado que venía de un usuario conserva la fuente "admin" al editarlo.
    source: food.source === "user" ? "admin" : food.source,
    sourceRef: food.source_ref ?? "",
    sourceUrl: food.source_url ?? "",
    license: food.license ?? "",
    verificationStatus: food.verification_status,
    isPublic: food.is_public,
    portions: food.portions.map((p) => ({
      id: p.id,
      label: p.label,
      quantity: Number(p.quantity),
      unit: p.unit,
      gramWeight: Number(p.gram_weight),
      isDefault: p.is_default,
    })),
  };
}

export default async function EditFoodPage({ params }: Props) {
  await requireRole("editor");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const food = await getFoodForEdit(supabase, id);
  if (!food) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/alimentos">
            <ChevronLeft aria-hidden="true" />
            Alimentos
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Editar alimento"
        title={food.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{FOOD_SOURCE_LABELS[food.source]}</Badge>
            <Badge variant="outline">{VERIFICATION_LABELS[food.verification_status]}</Badge>
            <span>
              Actualizado {formatDateTime(food.updated_at)}
              {food.verified_at ? ` · revisado ${formatDateTime(food.verified_at)}` : ""}
            </span>
          </span>
        }
      />
      <FoodForm key={food.updated_at} initial={toInput(food)} usedInPublishedRecipes={food.usedInPublishedRecipes} />
    </div>
  );
}
