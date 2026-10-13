/**
 * Errores del módulo de IA con su status HTTP y un mensaje en español listo para mostrar.
 * Los route handlers responden `{ error: { code, message } }` (docs/CONVENTIONS.md).
 * Puro: se puede importar desde cliente (solo constantes y la clase).
 */

export const AI_ERROR_STATUS = {
  /** Falta ANTHROPIC_API_KEY o la clave no es válida. */
  AI_NOT_CONFIGURED: 503,
  /** Se acabó el cupo mensual del plan. */
  AI_QUOTA_EXCEEDED: 429,
  /** El modelo (o sus filtros de seguridad) se negó a responder. */
  AI_REFUSED: 422,
  /** La respuesta no cumplió el esquema (o quedó cortada). */
  AI_INVALID_OUTPUT: 502,
  /** Error del proveedor (5xx, solicitud rechazada). */
  AI_PROVIDER_ERROR: 502,
  /** El proveedor nos limitó por exceso de solicitudes. */
  AI_RATE_LIMITED: 429,
  /** No se pudo conectar con el proveedor (red o tiempo de espera). */
  AI_UNAVAILABLE: 503,
  /** La persona canceló la solicitud (cerró la pestaña, detuvo el chat). */
  AI_ABORTED: 499,
  /** `complete_ai_request` devolvió false: la solicitud ya estaba cerrada o no es tuya. */
  AI_REQUEST_CLOSED: 409,
  /** No se pudo reservar el cupo (fallo de la base, no de la persona). */
  AI_QUOTA_ERROR: 500,
} as const;

export type AiErrorCode = keyof typeof AI_ERROR_STATUS;

export const AI_ERROR_MESSAGES: Record<AiErrorCode, string> = {
  AI_NOT_CONFIGURED: "La IA está pendiente de configurar. Mientras tanto, puedes buscar el alimento por nombre.",
  AI_QUOTA_EXCEEDED: "Usaste todo tu cupo de IA de este mes. Puedes seguir registrando con la búsqueda o el código de barras.",
  AI_REFUSED: "La IA no pudo procesar esta solicitud. No se registró nada; intenta con otra foto o descríbelo con tus palabras.",
  AI_INVALID_OUTPUT: "La IA respondió algo que no pudimos entender. No se registró nada; inténtalo de nuevo.",
  AI_PROVIDER_ERROR: "El servicio de IA tuvo un problema. No se registró nada; inténtalo en unos minutos.",
  AI_RATE_LIMITED: "El servicio de IA está recibiendo muchas solicitudes. Espera un momento y vuelve a intentarlo.",
  AI_UNAVAILABLE: "No pudimos conectar con el servicio de IA. Revisa tu conexión e inténtalo de nuevo.",
  AI_ABORTED: "Se canceló la solicitud.",
  AI_REQUEST_CLOSED: "Esta solicitud ya no es válida. Vuelve a intentarlo.",
  AI_QUOTA_ERROR: "No pudimos verificar tu cupo de IA. Inténtalo de nuevo.",
};

/** Datos de uso que conviene guardar aunque la llamada falle (tokens y costo ya gastados). */
export type AiErrorMeta = {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number | null;
  latencyMs?: number;
};

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status: number;
  readonly meta: AiErrorMeta | undefined;

  constructor(code: AiErrorCode, options: { message?: string; meta?: AiErrorMeta; cause?: unknown } = {}) {
    super(options.message ?? AI_ERROR_MESSAGES[code], options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AiError";
    this.code = code;
    this.status = AI_ERROR_STATUS[code];
    this.meta = options.meta;
  }
}

export function isAiError(error: unknown): error is AiError {
  return error instanceof AiError;
}

/** Códigos que devuelven las rutas además de los de IA (guardas de acceso y validación). */
export const ROUTE_ERROR_CODES = {
  UNAUTHORIZED: 401,
  PREMIUM_REQUIRED: 403,
  CONSENT_REQUIRED: 403,
  VALIDATION: 400,
  RATE_LIMITED: 429,
  TRANSCRIPTION_NOT_CONFIGURED: 503,
  NOT_CONFIGURED: 503,
  NOT_FOUND: 404,
  UNEXPECTED: 500,
} as const;
