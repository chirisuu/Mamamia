"use server";

import type { ActionResult } from "@/lib/action-result";
import { contentMoveSchema, contentPageSchema, contentStatusSchema, idSchema, type ContentPageInput } from "../schemas";
import { runAdminAction, type Revalidate } from "../server/action";
import { deleteContentPage, moveContentPage, saveContentPage, setContentStatus } from "../server/content";

// Los contenidos se leen en el sitio público (FAQ, legales, landing): se revalida todo el sitio.
const REVALIDATE: Revalidate[] = ["/admin/contenidos", { path: "/", type: "layout" }];

export async function saveContentPageAction(input: ContentPageInput): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAdminAction("editor", contentPageSchema, input, ({ supabase, data }) => saveContentPage(supabase, data), REVALIDATE);
}

export async function setContentStatusAction(input: { id: string; status: "draft" | "published" }): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    contentStatusSchema,
    input,
    async ({ supabase, data }) => {
      await setContentStatus(supabase, data);
      return null;
    },
    REVALIDATE,
  );
}

export async function moveContentPageAction(input: { id: string; direction: "up" | "down" }): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    contentMoveSchema,
    input,
    async ({ supabase, data }) => {
      await moveContentPage(supabase, data);
      return null;
    },
    REVALIDATE,
  );
}

export async function deleteContentPageAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAdminAction(
    "editor",
    idSchema,
    input,
    async ({ supabase, data }) => {
      await deleteContentPage(supabase, data.id);
      return null;
    },
    REVALIDATE,
  );
}
