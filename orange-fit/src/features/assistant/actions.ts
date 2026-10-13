"use server";

import { revalidatePath } from "next/cache";
import { fail, invalid, ok, type ActionResult } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { conversationIdSchema } from "./schemas";

/** Borra una conversación propia y sus mensajes (cascada). */
export async function deleteConversationAction(values: { conversationId: string }): Promise<ActionResult<null>> {
  const user = await requireUser("/app/asistente");
  const parsed = conversationIdSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assistant_conversations")
    .delete()
    .eq("id", parsed.data.conversationId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return fail("DB_ERROR", "No pudimos borrar la conversación. Inténtalo de nuevo.");
  if (!data?.length) return fail("NOT_FOUND", "Esa conversación ya no existe.");
  revalidatePath("/app/asistente");
  return ok(null);
}
