/** Respuestas JSON de las rutas de pagos (`{ error: { code, message } }` en errores). */
const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function billingJson(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function billingError(status: number, code: string, message: string): Response {
  return billingJson(status, { error: { code, message } });
}

export const NOT_CONFIGURED_MESSAGE = "Los pagos están pendientes de configurar. Aún no podemos procesar cobros.";
