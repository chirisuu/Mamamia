import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { DEFAULT_TIMEZONE, isValidTimeZone, localDateInTz } from "@/lib/dates";
import { buildAccountExport, ExportError, exportFilename } from "@/features/profile/server/export";

export const dynamic = "force-dynamic";

const json = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });

/** Descarga de todos los datos de la persona (JSON). Gratis para todos: es un derecho, no una función premium. */
export async function GET() {
  if (!isSupabaseConfigured()) return json(503, "NOT_CONFIGURED", "La base de datos no está configurada.");
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return json(401, "UNAUTHORIZED", "Inicia sesión para descargar tus datos.");

  const { data: allowed, error: rateError } = await supabase.rpc("check_rate_limit", {
    bucket: "account_export",
    max_hits: 5,
    window_seconds: 3600,
  });
  if (rateError) return json(500, "RATE_LIMIT_ERROR", "No pudimos preparar tu descarga. Inténtalo de nuevo.");
  if (!allowed) return json(429, "RATE_LIMITED", "Ya descargaste tus datos varias veces en la última hora. Espera un poco.");

  try {
    const now = new Date();
    const payload = await buildAccountExport(supabase, user, now);
    const tz = typeof payload.profile?.timezone === "string" && isValidTimeZone(payload.profile.timezone) ? payload.profile.timezone : DEFAULT_TIMEZONE;
    const filename = exportFilename(localDateInTz(now, tz));
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Nada parcial: si una sección falla, no entregamos una copia incompleta como si fuera total.
    const section = error instanceof ExportError ? error.section : "unknown";
    console.error("account_export_failed", { section });
    return json(500, "EXPORT_FAILED", "No pudimos reunir todos tus datos. Inténtalo de nuevo en unos minutos.");
  }
}
