import { getAppSettings } from "@/lib/config/app-settings";
import { hasFeature } from "@/lib/billing/entitlements";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPlanPdf, pdfFileName, planPdfData } from "@/features/planner/lib/pdf";
import { getPlan } from "@/features/planner/queries";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

/** PDF del plan (Premium `exports`): tabla por día y totales, con pdf-lib y Helvetica. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return json(503, "NOT_CONFIGURED", "El servicio de datos no está configurado.");
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json(401, "UNAUTHORIZED", "Inicia sesión para exportar tu plan.");
  if (!(await hasFeature("exports"))) return json(403, "PREMIUM_REQUIRED", "Exportar en PDF es parte de Premium.");
  if (!UUID.test(id)) return json(404, "NOT_FOUND", "No encontramos ese plan.");

  let plan: Awaited<ReturnType<typeof getPlan>>;
  try {
    plan = await getPlan(supabase, auth.user.id, id);
  } catch {
    return json(500, "DB_ERROR", "No pudimos leer el plan.");
  }
  if (!plan) return json(404, "NOT_FOUND", "No encontramos ese plan.");

  try {
    const { appName } = await getAppSettings();
    const bytes = await buildPlanPdf(planPdfData(plan, appName));
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${pdfFileName(plan.name)}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[planner] pdf falló", error instanceof Error ? error.name : typeof error);
    return json(500, "PDF_ERROR", "No pudimos generar el PDF. Inténtalo de nuevo.");
  }
}
