import "server-only";
import { revalidatePath } from "next/cache";
import type { User } from "@supabase/supabase-js";
import type { z } from "zod";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { requireRole, type AppRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AdminOpError, type Db } from "./db";

export type Revalidate = string | { path: string; type: "layout" | "page" };

/**
 * Esqueleto común de las Server Actions del panel:
 * 1) `requireRole(role)` en CADA acción (sin rol → 404, sin sesión → ingreso; no se captura);
 * 2) Zod sobre la entrada; 3) operación con el cliente de la sesión (RLS del staff);
 * 4) revalidatePath; 5) ActionResult con mensajes en español.
 */
export async function runAdminAction<S extends z.ZodType, T>(
  role: AppRole,
  schema: S,
  input: unknown,
  operation: (ctx: { supabase: Db; user: User; data: z.output<S> }) => Promise<T>,
  revalidate: Revalidate[] = [],
): Promise<ActionResult<T>> {
  const user = await requireRole(role);
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  let result: ActionResult<T>;
  try {
    const supabase = await createSupabaseServerClient();
    result = ok(await operation({ supabase, user, data: parsed.data }));
  } catch (error) {
    result = toAdminFailure(error);
  }
  // También tras un error: si falló la auditoría, el cambio ya está guardado y la vista debe reflejarlo.
  revalidateAll(revalidate);
  return result;
}

export function revalidateAll(list: Revalidate[]) {
  for (const r of list) {
    if (typeof r === "string") revalidatePath(r);
    else revalidatePath(r.path, r.type);
  }
}

export function toAdminFailure(error: unknown): ActionResult<never> {
  if (error instanceof AdminOpError) return fail(error.code, error.message);
  console.error("[admin] acción falló", error instanceof Error ? error.name : typeof error);
  return fail("UNEXPECTED", "Algo salió mal. Inténtalo de nuevo.");
}
