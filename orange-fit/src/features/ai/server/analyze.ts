import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreparedImage } from "@/lib/ai/image";
import { matchCandidates } from "@/lib/ai/matching";
import type { PhotoAnalysis, TextParse } from "@/lib/ai/normalize";
import type { NutritionAI } from "@/lib/ai/provider";
import { runWithAiQuota } from "@/lib/ai/quota";
import type { Database, Json } from "@/lib/db/database.types";
import type { FoodWithPortions } from "@/lib/foods/api-types";
import type { PhotoAnalysisResponse, TextAnalysisResponse } from "../schemas";

/**
 * Orquestación de los análisis con IA: cupo → proveedor → coincidencias en la base → cierre de la
 * solicitud. NO escribe en el diario: devuelve candidatos para que la persona los confirme
 * (`confirmAiItemsAction` → `addItemsToMeal`). En `ai_analysis_requests.output` se guarda lo que
 * propuso la IA y los ids de las coincidencias, nunca valores nutricionales.
 */

type Client = SupabaseClient<Database>;

export const MEAL_PHOTOS_BUCKET = "meal-photos";

type Deps = { supabase: Client; userId: string; ai: NutritionAI };

const matchIds = (matches: FoodWithPortions[]) => matches.map((m) => m.id);

export function photoOutputForStorage(analysis: PhotoAnalysis, matches: FoodWithPortions[][]): Json {
  return {
    is_food_image: analysis.isFoodImage,
    uncertainty_note: analysis.uncertaintyNote,
    items: analysis.items.map((item, i) => ({
      name_es: item.nameEs,
      preparation: item.preparation,
      estimated_grams: item.estimatedGrams,
      confidence: item.confidence,
      visible_evidence: item.visibleEvidence,
      match_food_ids: matchIds(matches[i] ?? []),
    })),
  };
}

export function textOutputForStorage(parse: TextParse, matches: FoodWithPortions[][]): Json {
  return {
    items: parse.items.map((item, i) => ({
      food_query: item.foodQuery,
      quantity: item.quantity,
      unit: item.unit,
      grams_if_stated: item.gramsIfStated,
      needs_clarification: item.needsClarification,
      clarification_question: item.clarificationQuestion,
      match_food_ids: matchIds(matches[i] ?? []),
    })),
  };
}

/** Ruta de la foto en Storage: `{uid}/{fecha local}/{id de la solicitud}.jpg` (solo el dueño la lee). */
export function mealPhotoPath(userId: string, localDate: string, requestId: string): string {
  return `${userId}/${localDate}/${requestId}.jpg`;
}

export async function analyzePhoto(
  { supabase, userId, ai }: Deps,
  input: { image: PreparedImage; savePhoto: boolean; localDate: string; signal?: AbortSignal },
): Promise<PhotoAnalysisResponse> {
  // Objeto (no `let`) para que el cierre de abajo vea la ruta asignada dentro del callback.
  const saved: { path: string | null } = { path: null };
  try {
    const { result, requestId, reservation } = await runWithAiQuota(
      supabase,
      "photo",
      async (requestId) => {
        let photoSaved: boolean | null = null;
        if (input.savePhoto) {
          const path = mealPhotoPath(userId, input.localDate, requestId);
          const { error } = await supabase.storage
            .from(MEAL_PHOTOS_BUCKET)
            .upload(path, input.image.buffer, { contentType: input.image.mediaType, upsert: false });
          photoSaved = !error;
          if (!error) saved.path = path;
          else console.error("[ai] no se pudo guardar la foto", { reason: error.name ?? "storage" });
        }
        const { output, meta } = await ai.identifyFoodsFromPhoto(
          { imageBase64: input.image.buffer.toString("base64"), mediaType: input.image.mediaType },
          { signal: input.signal },
        );
        const matches = await matchCandidates(
          supabase,
          output.items.map((item) => item.nameEs),
        );
        return {
          result: { output, matches, photoSaved },
          completion: {
            provider: meta.provider,
            model: meta.model,
            output: photoOutputForStorage(output, matches),
            tokensInput: meta.inputTokens,
            tokensOutput: meta.outputTokens,
            estimatedCostUsd: meta.estimatedCostUsd,
            latencyMs: meta.latencyMs,
            inputStoragePath: saved.path,
          },
        };
      },
      { provider: ai.provider },
    );
    return {
      requestId,
      isFoodImage: result.output.isFoodImage,
      uncertaintyNote: result.output.uncertaintyNote,
      candidates: result.output.items.map((item, i) => ({ ...item, key: `p${i}`, matches: result.matches[i] ?? [] })),
      photoSaved: result.photoSaved,
      quota: { used: reservation.used, limit: reservation.limit },
    };
  } catch (error) {
    // Si el análisis no se entrega, la foto guardada no sirve de nada: se borra.
    if (saved.path) await supabase.storage.from(MEAL_PHOTOS_BUCKET).remove([saved.path]).catch(() => undefined);
    throw error;
  }
}

export async function analyzeText(
  { supabase, ai }: Deps,
  input: { text: string; mode: "text" | "voice"; signal?: AbortSignal },
): Promise<TextAnalysisResponse> {
  const { result, requestId, reservation } = await runWithAiQuota(
    supabase,
    input.mode === "voice" ? "voice" : "text",
    async () => {
      const { output, meta } = await ai.parseFoodText({ text: input.text }, { signal: input.signal });
      const matches = await matchCandidates(
        supabase,
        output.items.map((item) => item.foodQuery),
      );
      return {
        result: { output, matches },
        completion: {
          provider: meta.provider,
          model: meta.model,
          output: textOutputForStorage(output, matches),
          tokensInput: meta.inputTokens,
          tokensOutput: meta.outputTokens,
          estimatedCostUsd: meta.estimatedCostUsd,
          latencyMs: meta.latencyMs,
        },
      };
    },
    { provider: ai.provider },
  );
  return {
    requestId,
    mode: input.mode,
    candidates: result.output.items.map((item, i) => ({ ...item, key: `t${i}`, matches: result.matches[i] ?? [] })),
    quota: { used: reservation.used, limit: reservation.limit },
  };
}
