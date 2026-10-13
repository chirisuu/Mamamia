import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionError } from "@/lib/action-result";

/** Pinta en el formulario los errores por campo que devolvió el servidor (misma ruta que Zod). */
export function applyFieldErrors<T extends FieldValues>(setError: UseFormSetError<T>, error: ActionError): boolean {
  const entries = Object.entries(error.fieldErrors ?? {}).filter(([, messages]) => messages?.length);
  for (const [path, messages] of entries) {
    setError((path === "_" ? "root" : path) as Path<T>, { type: "server", message: messages?.[0] });
  }
  return entries.length > 0;
}
