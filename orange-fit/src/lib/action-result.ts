import type { z } from "zod";

export type ActionError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: ActionError };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (code: string, message: string, fieldErrors?: ActionError["fieldErrors"]): ActionResult<never> => ({
  ok: false,
  error: { code, message, fieldErrors },
});

/** Convierte un error de Zod en un ActionResult con los errores por campo. */
export function invalid(error: z.ZodError, message = "Revisa los datos marcados."): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("VALIDATION", message, fieldErrors);
}
