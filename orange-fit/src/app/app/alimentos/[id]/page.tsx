import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OwnFoodForm } from "@/features/diary/components/own-food-form";
import { getOwnFoodForEdit, type OwnFoodForEdit } from "@/features/diary/queries";
import { getDiaryPageContext } from "@/features/diary/server/page-context";

export const metadata: Metadata = { title: "Editar alimento" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: number | null | undefined) => (v == null ? "" : String(v));

export default async function EditFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const ctx = await getDiaryPageContext(`/app/alimentos/${id}`);
  let food: OwnFoodForEdit | null = null;
  let failed = false;
  try {
    food = await getOwnFoodForEdit(ctx.supabase, ctx.user.id, id);
  } catch {
    failed = true;
  }
  if (!failed && !food) notFound();

  return (
    <>
      <AppHeader title="Editar alimento" subtitle={food?.name} backHref="/app/alimentos" />
      <div className="pt-2 pb-8">
        {food ? (
          <OwnFoodForm
            foodId={food.id}
            defaults={{
              name: food.name,
              brandName: food.brandName ?? "",
              barcode: food.barcode ?? "",
              basis: "per100g",
              energyKcal: str(food.per100g.energyKcal),
              proteinG: str(food.per100g.proteinG),
              carbsG: str(food.per100g.carbsG),
              fatG: str(food.per100g.fatG),
              fiberG: str(food.per100g.fiberG),
              sugarG: str(food.per100g.sugarG),
              saturatedFatG: str(food.per100g.saturatedFatG),
              sodiumMg: str(food.per100g.sodiumMg),
              portions: food.portions.map((p) => ({
                label: p.label,
                quantity: String(p.quantity),
                unit: p.unit,
                gramWeight: String(p.gramWeight),
                isDefault: p.isDefault,
              })),
            }}
          />
        ) : (
          <Alert variant="destructive">
            <AlertTitle>No pudimos cargar el alimento</AlertTitle>
            <AlertDescription>Revisa tu conexión y recarga la página.</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}
