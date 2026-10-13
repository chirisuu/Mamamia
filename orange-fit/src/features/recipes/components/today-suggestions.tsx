import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/db/database.types";
import { formatNumber } from "@/lib/format";
import type { RecipeCard as RecipeCardData } from "../lib/adapters";
import type { RecipeMealType } from "../lib/labels";
import { recommendForToday } from "../lib/recommend";
import { getTodayRemaining } from "../queries";
import { RecipeImage } from "./recipe-image";

/**
 * "Para tu meta de hoy" (Premium `smart_recipes`): se monta dentro de <PremiumGate>, así que solo
 * consulta datos si la persona tiene la función.
 */
export async function TodaySuggestions({
  supabase,
  userId,
  today,
  cards,
  mealType,
}: {
  supabase: SupabaseClient<Database>;
  userId: string;
  today: string;
  cards: RecipeCardData[];
  mealType: RecipeMealType;
}) {
  let data: Awaited<ReturnType<typeof getTodayRemaining>>;
  try {
    data = await getTodayRemaining(supabase, userId, today);
  } catch {
    return <p className="text-sm text-muted-foreground">No pudimos calcular lo que te queda hoy. Recarga la página para intentarlo de nuevo.</p>;
  }
  const result = recommendForToday(cards, {
    remainingKcal: data.remainingKcal,
    remainingProteinG: data.remainingProteinG,
    avoidAllergens: [...(data.goal?.allergies ?? []), ...(data.goal?.intolerances ?? [])],
    dietPattern: data.goal?.diet_pattern ?? null,
    mealType,
  });

  if (result.status === "no_target") {
    return (
      <div className="flex flex-col items-start gap-2 text-sm">
        <p className="text-muted-foreground">Para sugerirte recetas según lo que te queda hoy necesitamos tu meta de calorías.</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/perfil/metas">Definir mi meta</Link>
        </Button>
      </div>
    );
  }
  if (result.status === "met") {
    return (
      <p className="text-sm text-muted-foreground">
        Hoy ya cubriste tu meta de calorías. Si te da hambre, una opción con proteína y verduras siempre suma; escucha a tu cuerpo.
      </p>
    );
  }
  if (result.status === "none") {
    return <p className="text-sm text-muted-foreground">No encontramos recetas que encajen con lo que te queda y tus restricciones. Prueba con el catálogo completo.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground" data-numeric>
        Te quedan {formatNumber(data.remainingKcal)} kcal
        {data.remainingProteinG != null ? ` y ${formatNumber(data.remainingProteinG)} g de proteína` : ""} para hoy.
      </p>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
        {result.items.map((s) => (
          <li key={s.card.id} className="w-64 shrink-0 lg:w-auto">
            <Link
              href={`/app/recetas/${s.card.slug}`}
              className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RecipeImage url={s.card.imageUrl} title={s.card.title} className="aspect-[16/9] w-full" sizes="16rem" />
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 font-semibold leading-snug">{s.card.title}</p>
                <p className="text-sm tabular-nums">
                  {formatNumber(s.servings, Number.isInteger(s.servings) ? 0 : 2)} {s.servings === 1 ? "porción" : "porciones"} · {formatNumber(s.kcal)} kcal
                </p>
                <p className="text-xs text-muted-foreground">{s.reason}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        Sugerencias por reglas simples (kcal y proteína que te quedan), sin IA. No reemplazan a un profesional.
      </p>
    </div>
  );
}
