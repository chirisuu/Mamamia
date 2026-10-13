import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/features/auth/server/same-origin";
import { MAX_ERROR_REPORT_BODY, buildErrorReportRow, clientIpFrom, errorReportInputSchema } from "@/features/marketing/error-report";
import { createAnonReporterClient, insertErrorReport } from "@/features/marketing/server/error-reports";

export const dynamic = "force-dynamic";

const json = (status: number, body: unknown) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

/**
 * POST /api/errors — reporte de un error de la interfaz: { message, route?, digest? }.
 * El usuario sale de la sesión (si hay) y el user agent de la cabecera; ambos truncados y sin datos
 * sensibles. Anónimos permitidos con el límite de la BD (20/h por IP; 60/h por usuario) → 429.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "FORBIDDEN", "Origen no permitido.");
  if (!isSupabaseConfigured()) return fail(503, "NOT_CONFIGURED", "El registro de errores no está configurado.");

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_ERROR_REPORT_BODY) {
    return fail(413, "PAYLOAD_TOO_LARGE", "El reporte es demasiado grande.");
  }
  const text = await request.text().catch(() => "");
  if (text.length > MAX_ERROR_REPORT_BODY) return fail(413, "PAYLOAD_TOO_LARGE", "El reporte es demasiado grande.");

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, "INVALID_JSON", "El cuerpo debe ser JSON.");
  }
  const parsed = errorReportInputSchema.safeParse(raw);
  if (!parsed.success) return fail(400, "VALIDATION", parsed.error.issues[0]?.message ?? "Reporte inválido.");

  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    const row = buildErrorReportRow(parsed.data, { userId: user?.id ?? null, userAgent: request.headers.get("user-agent") });
    const client = user ? supabase : createAnonReporterClient(clientIpFrom(request.headers));

    const result = await insertErrorReport(client, row);
    if (!result.ok) {
      if (result.status === 429) return fail(429, "RATE_LIMITED", "Recibimos demasiados reportes. Intenta más tarde.");
      console.error("error_report_insert_failed", { code: result.code });
      return fail(500, "INSERT_FAILED", "No pudimos guardar el reporte.");
    }
    return json(201, { ok: true });
  } catch {
    console.error("error_report_unexpected");
    return fail(500, "INTERNAL", "No pudimos guardar el reporte.");
  }
}
