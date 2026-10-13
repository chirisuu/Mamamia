import { analyzePhoto } from "@/features/ai/server/analyze";
import { getUserTimezone } from "@/features/ai/server/profile";
import { AI_RATE_LIMITS, aiErrorResponse, aiJsonError, aiJsonOk, enforceAiRateLimit, guardAiRoute } from "@/features/ai/server/http";
import type { PhotoAnalysisResponse } from "@/features/ai/schemas";
import { getNutritionAI } from "@/lib/ai/config";
import { assertImageUpload, MAX_UPLOAD_BYTES, prepareFoodImage } from "@/lib/ai/image";
import { localDateInTz } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/ai/photo (multipart: `image` JPG/PNG/WebP ≤ 8 MB, `savePhoto` "true"|"false").
 * Exige sesión, Premium (ai_photo), consentimiento ai_processing vigente y la IA configurada.
 * La imagen se re-codifica en el servidor (≤ 1568 px, sin metadatos). Solo se guarda en
 * `meal-photos/{uid}/…` si la persona lo eligió. Devuelve candidatos: NO registra nada.
 */
export async function POST(request: Request) {
  const guard = await guardAiRoute("photo");
  if (!guard.ok) return guard.response;
  const { supabase, user } = guard;

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES + 512 * 1024) {
    return aiJsonError(413, "IMAGE_TOO_LARGE", "La imagen pesa más de 8 MB. Usa una foto más liviana.");
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return aiJsonError(400, "VALIDATION", "Envía la foto como formulario (campo «image»).");
  }
  const file = form.get("image");
  if (!(file instanceof Blob)) return aiJsonError(400, "VALIDATION", "Adjunta una foto de tu comida.");
  const savePhoto = form.get("savePhoto") === "true";

  try {
    assertImageUpload({ size: file.size, type: file.type });
    const image = await prepareFoodImage(Buffer.from(await file.arrayBuffer()));

    const limited = await enforceAiRateLimit(supabase, AI_RATE_LIMITS.photo.bucket, AI_RATE_LIMITS.photo.max, AI_RATE_LIMITS.photo.window);
    if (limited) return limited;

    const ai = getNutritionAI();
    if (!ai) return aiJsonError(503, "AI_NOT_CONFIGURED", "La IA está pendiente de configurar.");
    const timezone = await getUserTimezone(supabase, user.id);
    const result = await analyzePhoto(
      { supabase, userId: user.id, ai },
      { image, savePhoto, localDate: localDateInTz(new Date(), timezone), signal: request.signal },
    );
    return aiJsonOk<PhotoAnalysisResponse>(result);
  } catch (error) {
    return aiErrorResponse(error);
  }
}
