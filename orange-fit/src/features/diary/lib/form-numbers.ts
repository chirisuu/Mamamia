/**
 * Números escritos en formularios (acepta coma o punto decimal). Los formularios guardan texto
 * y convierten al enviar; el servidor vuelve a validar con los esquemas de `schemas.ts`.
 */
import { z } from "zod";

export function parseDecimal(raw: string | null | undefined): number | null {
  const t = (raw ?? "").trim().replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Campo numérico como texto: obligatorio u opcional, con máximo. */
export function decimalField(options: { required?: boolean; max?: number; positive?: boolean } = {}) {
  const { required = false, max = 100000, positive = false } = options;
  return z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      if (!value) {
        if (required) ctx.addIssue({ code: "custom", message: "Completa este campo." });
        return;
      }
      const n = parseDecimal(value);
      if (n == null) ctx.addIssue({ code: "custom", message: "Escribe un número (usa punto o coma para decimales)." });
      else if (positive && n <= 0) ctx.addIssue({ code: "custom", message: "Debe ser mayor que 0." });
      else if (n > max) ctx.addIssue({ code: "custom", message: `El máximo es ${max}.` });
    });
}
