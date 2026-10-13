import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ChevronLeft, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recipeImageUrl } from "@/features/recipes/lib/image";
import {
  ALLERGENS,
  allergenLabel,
  DIET_TAGS,
  dietTagLabel,
  DIFFICULTIES,
  difficultyLabel,
  mealTypeLabel,
  RECIPE_MEAL_TYPES,
} from "@/features/recipes/lib/labels";
import { formatDateTime } from "@/features/admin/components/admin-ui";
import { OfficialRecipeForm, type IngredientFood } from "@/features/admin/components/official-recipe-form";
import { RecipeImageUploader } from "@/features/admin/components/recipe-image-uploader";
import { RecipeReviewForm } from "@/features/admin/components/recipe-review-form";
import { RECIPE_STATUS_LABELS } from "@/features/admin/lib/labels";
import type { OfficialRecipeInput } from "@/features/admin/schemas";
import { getAdminRecipe, type AdminRecipeDetail } from "@/features/admin/server/recipes";

export const metadata: Metadata = { title: "Receta" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function only<T extends string>(values: readonly string[] | null | undefined, allowed: readonly T[]): T[] {
  return (values ?? []).filter((v): v is T => (allowed as readonly string[]).includes(v));
}

function stepsOf(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
}

function toInput(detail: AdminRecipeDetail): OfficialRecipeInput {
  const r = detail.recipe;
  const steps = stepsOf(r.steps);
  return {
    recipeId: r.id,
    title: r.title,
    description: r.description ?? "",
    servings: Number(r.servings),
    prepMinutes: r.prep_minutes,
    cookMinutes: r.cook_minutes,
    difficulty: only(r.difficulty ? [r.difficulty] : [], DIFFICULTIES)[0] ?? null,
    steps: steps.length ? steps : [""],
    tags: r.tags ?? [],
    dietTags: only(r.diet_tags, DIET_TAGS),
    allergens: only(r.allergens, ALLERGENS),
    mealTypes: only(r.meal_types, RECIPE_MEAL_TYPES),
    estimatedCost: r.estimated_cost == null ? null : Number(r.estimated_cost),
    costCurrency: r.cost_currency ?? "PEN",
    status: r.status === "published" ? "published" : "draft",
    ingredients: detail.ingredients.map((i) => ({
      foodId: i.foodId,
      grams: i.grams,
      displayQuantity: i.displayQuantity,
      displayUnit: i.displayUnit,
      note: i.note,
    })),
  };
}

function foodsOf(detail: AdminRecipeDetail): Record<string, IngredientFood> {
  return Object.fromEntries(detail.ingredients.map((i) => [i.foodId, { name: i.foodName, brandName: i.brandName, per100g: i.per100g }]));
}

const STATUS_BADGE = { pending_review: "default", published: "success", draft: "secondary", rejected: "outline" } as const;

export default async function AdminRecipePage({ params }: Props) {
  await requireRole("editor");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const detail = await getAdminRecipe(supabase, id);
  if (!detail) notFound();
  const r = detail.recipe;
  const publicHref = r.status === "published" && r.is_public ? `/app/recetas/${r.slug}` : null;

  const back = (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href="/admin/recetas">
          <ChevronLeft aria-hidden="true" />
          Recetas
        </Link>
      </Button>
    </div>
  );
  const header = (
    <PageHeader
      eyebrow={detail.isOfficial ? "Receta oficial" : "Receta de usuario"}
      title={r.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_BADGE[r.status]}>{RECIPE_STATUS_LABELS[r.status]}</Badge>
          <span className="font-mono text-xs">{r.slug}</span>
          <span>· actualizada {formatDateTime(r.updated_at)}</span>
        </span>
      }
      actions={
        publicHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={publicHref} target="_blank" rel="noopener">
              <ExternalLink aria-hidden="true" />
              Ver en la app
            </Link>
          </Button>
        ) : null
      }
    />
  );

  if (detail.isOfficial) {
    return (
      <div className="grid gap-6">
        {back}
        {header}
        <Card>
          <CardHeader>
            <CardTitle as="h2">Imagen</CardTitle>
            <CardDescription>Foto horizontal 4:3. Se convierte a WebP en tu navegador y se normaliza en el servidor.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecipeImageUploader recipeId={r.id} title={r.title} slug={r.slug} imageUrl={recipeImageUrl(r.image_path, r.updated_at)} />
          </CardContent>
        </Card>
        <OfficialRecipeForm key={r.updated_at} initial={toInput(detail)} foods={foodsOf(detail)} />
      </div>
    );
  }

  const n = detail.nutrition;
  const privateFoods = detail.ingredients.filter((i) => !i.foodIsPublic).length;
  const steps = stepsOf(r.steps);
  const blockReason =
    privateFoods > 0
      ? `No se puede publicar: ${privateFoods} ingrediente(s) no son del catálogo público. Recházala pidiendo que los cambie.`
      : detail.ingredients.length === 0
        ? "No se puede publicar: no tiene ingredientes."
        : null;

  return (
    <div className="grid gap-6">
      {back}
      {header}
      {r.status === "pending_review" ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Revisión</CardTitle>
            <CardDescription>Comprueba ingredientes, cantidades y pasos. Al publicarla, aparece en el catálogo para todas las personas.</CardDescription>
          </CardHeader>
          <CardContent>
            <RecipeReviewForm recipeId={r.id} canPublish={blockReason === null} blockReason={blockReason} />
          </CardContent>
        </Card>
      ) : r.review_note ? (
        <Alert>
          <AlertTitle>Nota de la revisión</AlertTitle>
          <AlertDescription>
            <p>{r.review_note}</p>
            {r.reviewed_at ? <p className="text-xs">Revisada {formatDateTime(r.reviewed_at)}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Ingredientes</CardTitle>
            <CardDescription>
              {formatNumber(Number(r.servings), 1)} porción(es)
              {r.prep_minutes != null || r.cook_minutes != null ? ` · ${(r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)} min` : ""}
              {difficultyLabel(r.difficulty) ? ` · ${difficultyLabel(r.difficulty)}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {r.description ? <p className="text-sm">{r.description}</p> : null}
            {detail.ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ingredientes.</p>
            ) : (
              <ul className="grid gap-2">
                {detail.ingredients.map((i) => (
                  <li key={i.id} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2 text-sm">
                    {!i.foodIsPublic ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {i.foodName}
                        {i.brandName ? <span className="font-normal text-muted-foreground"> · {i.brandName}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground" data-numeric="">
                        {formatNumber(i.grams)} g
                        {i.displayQuantity != null && i.displayUnit ? ` (${formatNumber(i.displayQuantity, 2)} ${i.displayUnit})` : ""}
                        {i.note ? ` · ${i.note}` : ""}
                        {!i.foodIsPublic ? " · alimento propio del autor (no público)" : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-2">
              <h3 className="font-semibold">Preparación</h3>
              {steps.length ? (
                <ol className="ml-5 list-decimal space-y-1.5 text-sm">
                  {steps.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">Sin pasos.</p>
              )}
            </div>
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Por porción</CardTitle>
              <CardDescription>Calculado desde los ingredientes.</CardDescription>
            </CardHeader>
            <CardContent>
              {n && n.per_serving_energy_kcal != null ? (
                <dl className="grid grid-cols-2 gap-2 text-sm" data-numeric="">
                  <dt className="text-muted-foreground">Energía</dt>
                  <dd className="text-right font-medium">{formatNumber(n.per_serving_energy_kcal)} kcal</dd>
                  <dt className="text-muted-foreground">Proteína</dt>
                  <dd className="text-right font-medium">{formatNumber(n.per_serving_protein_g, 1)} g</dd>
                  <dt className="text-muted-foreground">Carbohidratos</dt>
                  <dd className="text-right font-medium">{formatNumber(n.per_serving_carbs_g, 1)} g</dd>
                  <dt className="text-muted-foreground">Grasa</dt>
                  <dd className="text-right font-medium">{formatNumber(n.per_serving_fat_g, 1)} g</dd>
                  <dt className="text-muted-foreground">Fibra</dt>
                  <dd className="text-right font-medium">
                    {n.fiber_incomplete ? "≥ " : ""}
                    {formatNumber(n.per_serving_fiber_g, 1)} g
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos de nutrición.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Etiquetas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <TagLine label="Comidas" values={(r.meal_types ?? []).map(mealTypeLabel)} />
              <TagLine label="Dieta" values={(r.diet_tags ?? []).map(dietTagLabel)} />
              <TagLine label="Alérgenos" values={(r.allergens ?? []).map(allergenLabel)} />
              <TagLine label="Otras" values={r.tags ?? []} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TagLine({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="grid gap-1">
      <p className="text-muted-foreground">{label}</p>
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <Badge key={v} variant="secondary">
              {v}
            </Badge>
          ))}
        </div>
      ) : (
        <p>—</p>
      )}
    </div>
  );
}
