"use server";

import type { ActionResult } from "@/lib/action-result";
import { settingsSchema, type SettingsInput } from "../schemas";
import { runAdminAction } from "../server/action";
import { saveSettings } from "../server/settings";

/** Configuración global (admin+). `app_name` se ve en todo el sitio: se revalida el layout raíz. */
export async function saveSettingsAction(input: SettingsInput): Promise<ActionResult<{ changed: string[] }>> {
  return runAdminAction("admin", settingsSchema, input, ({ supabase, data }) => saveSettings(supabase, data), [{ path: "/", type: "layout" }]);
}
