"use server";

import type { ActionResult } from "@/lib/action-result";
import { errorStatusSchema, type ErrorStatusInput } from "../schemas";
import { runAdminAction } from "../server/action";
import { setErrorStatus } from "../server/errors";

export async function setErrorStatusAction(input: ErrorStatusInput): Promise<ActionResult<null>> {
  return runAdminAction(
    "admin",
    errorStatusSchema,
    input,
    async ({ supabase, data }) => {
      await setErrorStatus(supabase, data);
      return null;
    },
    ["/admin/errores", "/admin"],
  );
}
