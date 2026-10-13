"use server";

import type { ActionResult } from "@/lib/action-result";
import { setUserRoleSchema, type SetUserRoleInput } from "../schemas";
import { runAdminAction } from "../server/action";
import { setUserRole } from "../server/users";

/** Otorgar o quitar editor/admin/professional: solo superadmin (superadmin se asigna por SQL). */
export async function setUserRoleAction(input: SetUserRoleInput): Promise<ActionResult<{ changed: boolean }>> {
  return runAdminAction("superadmin", setUserRoleSchema, input, ({ supabase, user, data }) => setUserRole(supabase, user.id, data), ["/admin/usuarios"]);
}
