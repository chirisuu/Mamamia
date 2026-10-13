/**
 * Cliente de GET /api/foods/barcode/{code} para el navegador: devuelve el producto o lanza un
 * `BarcodeLookupError` con el status y el mensaje real del servidor.
 */
import type { ApiErrorBody, BarcodeLookupResponse } from "@/lib/foods/api-types";

export class BarcodeLookupError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly product: { name: string | null; brandName: string | null } | null = null,
  ) {
    super(message);
    this.name = "BarcodeLookupError";
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function fetchBarcode(code: string, signal?: AbortSignal, fetchImpl: FetchLike = (i, init) => fetch(i, init)): Promise<BarcodeLookupResponse> {
  let res: Response;
  try {
    res = await fetchImpl(`/api/foods/barcode/${encodeURIComponent(code)}`, { signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new BarcodeLookupError(0, "NETWORK", "No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.");
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Sin JSON: se usa el mensaje genérico de abajo.
  }
  if (res.ok && body && typeof body === "object" && "food" in body) return body as BarcodeLookupResponse;
  const err = (body as ApiErrorBody | null)?.error;
  throw new BarcodeLookupError(
    res.status,
    err?.code ?? "UNKNOWN",
    err?.message ?? "No pudimos buscar el producto. Inténtalo de nuevo.",
    err?.product ?? null,
  );
}

/** ¿Tiene sentido reintentar automáticamente? (no para 4xx: la respuesta no cambiaría). */
export const isRetryableLookupError = (error: unknown) =>
  error instanceof BarcodeLookupError && (error.status === 0 || error.status >= 500);
