import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import { withPortions } from "@/lib/foods/details";
import { searchFoods } from "@/lib/foods/search";

/**
 * Une lo que propone la IA con alimentos REALES de la base. Para cada candidato se buscan hasta 3
 * coincidencias (públicos + propios, sin rechazados, vía `search_foods`) y la persona elige.
 * Los nutrientes siempre salen de la base al registrar (`addItemsToMeal`). Si no hay coincidencia,
 * la UI dice "sin dato verificado: busca el alimento o créalo"; nunca se usan valores de la IA.
 */

type Client = SupabaseClient<Database>;

export const MATCHES_PER_CANDIDATE = 3;

const PREPARATION_WORDS =
  /\b(a la plancha|a la parrilla|al horno|al vapor|frit[oa]s?|sancochad[oa]s?|hervid[oa]s?|cocid[oa]s?|crud[oa]s?|guisad[oa]s?|asad[oa]s?|salteado|salteada|rallad[oa]s?|picad[oa]s?|en trozos|en rodajas|entero|entera|natural|casero|casera|pequeñ[oa]s?|median[oa]s?|grandes?)\b/gi;

const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "con", "en", "y", "al", "a"]);

/**
 * Variantes de búsqueda de más específica a más general: el nombre tal cual, sin palabras de
 * preparación/tamaño y sus dos primeras palabras significativas. Puro y probado.
 */
export function searchQueryVariants(name: string): string[] {
  const base = name.replace(/\s+/g, " ").trim().slice(0, 80);
  const variants = [base];
  const withoutPrep = base.replace(PREPARATION_WORDS, " ").replace(/\s+/g, " ").trim().replace(/\b(de|con|y|en)$/i, "").trim();
  variants.push(withoutPrep);
  const words = withoutPrep.split(" ").filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  if (words.length > 2) variants.push(words.slice(0, 2).join(" "));
  if (words.length > 1) variants.push(words[0]);
  const seen = new Set<string>();
  return variants.filter((v) => {
    const key = v.toLowerCase();
    if (v.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Hasta `limit` alimentos de la base para un nombre propuesto por la IA (con sus porciones). */
export async function findFoodMatches(supabase: Client, name: string, limit = MATCHES_PER_CANDIDATE): Promise<FoodWithPortions[]> {
  for (const query of searchQueryVariants(name)) {
    const foods = await searchFoods(supabase, query, limit);
    if (foods.length > 0) return withPortions(supabase, foods.slice(0, limit));
  }
  return [];
}

/** Coincidencias para varios candidatos, en el mismo orden. */
export async function matchCandidates(supabase: Client, names: readonly string[], limit = MATCHES_PER_CANDIDATE): Promise<FoodWithPortions[][]> {
  return Promise.all(names.map((name) => findFoodMatches(supabase, name, limit)));
}
