import "server-only";
import type { z } from "zod";
import type { Tables } from "@/lib/db/database.types";
import type { ContentKind, ContentStatus } from "../lib/labels";
import type { contentMoveSchema, contentPageSchema, contentStatusSchema } from "../schemas";
import { AdminOpError, dbError, logAdminAction, type Db } from "./db";

export type ContentPage = Tables<"content_pages">;
export type ContentListItem = Pick<ContentPage, "id" | "slug" | "title" | "kind" | "status" | "sort_order" | "updated_at">;

export async function listContentPages(supabase: Db, filters: { kind?: ContentKind | null; status?: ContentStatus | null; q?: string | null }): Promise<ContentListItem[]> {
  let query = supabase
    .from("content_pages")
    .select("id, slug, title, kind, status, sort_order, updated_at")
    .order("kind")
    .order("sort_order")
    .order("title");
  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.q) {
    const term = filters.q.replace(/[%_,()]/g, " ").trim();
    if (term) query = query.or(`title.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  const { data, error } = await query.limit(500);
  if (error) throw dbError(error, "No se pudieron leer los contenidos.");
  return data ?? [];
}

export async function getContentPage(supabase: Db, id: string): Promise<ContentPage | null> {
  const { data, error } = await supabase.from("content_pages").select("*").eq("id", id).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer el contenido.");
  return data;
}

export async function saveContentPage(supabase: Db, data: z.output<typeof contentPageSchema>): Promise<{ id: string; slug: string }> {
  const row = {
    slug: data.slug,
    title: data.title,
    kind: data.kind,
    status: data.status,
    sort_order: data.sortOrder,
    body_md: data.bodyMd,
  };
  const query = data.id
    ? supabase.from("content_pages").update(row).eq("id", data.id).select("id, slug")
    : supabase.from("content_pages").insert(row).select("id, slug");
  const { data: saved, error } = await query;
  if (error) {
    if (error.code === "23505") throw new AdminOpError("CONFLICT", "Ya hay un contenido con esa dirección (slug). Usa otra.");
    throw dbError(error, "No se pudo guardar el contenido.");
  }
  const page = saved?.[0];
  if (!page) throw new AdminOpError(data.id ? "NOT_FOUND" : "FORBIDDEN", data.id ? "El contenido no existe." : "No tienes permiso para crear contenidos.");
  await logAdminAction(supabase, {
    action: data.id ? "content.update" : "content.create",
    targetTable: "content_pages",
    targetId: page.id,
    metadata: { kind: data.kind, status: data.status, slug: data.slug },
  });
  return page;
}

export async function setContentStatus(supabase: Db, data: z.output<typeof contentStatusSchema>): Promise<void> {
  const { data: saved, error } = await supabase.from("content_pages").update({ status: data.status }).eq("id", data.id).select("id");
  if (error) throw dbError(error, "No se pudo cambiar el estado.");
  if (!saved?.length) throw new AdminOpError("NOT_FOUND", "El contenido no existe.");
  await logAdminAction(supabase, { action: "content.status", targetTable: "content_pages", targetId: data.id, metadata: { status: data.status } });
}

export async function deleteContentPage(supabase: Db, id: string): Promise<void> {
  const { data: deleted, error } = await supabase.from("content_pages").delete().eq("id", id).select("id, kind");
  if (error) throw dbError(error, "No se pudo eliminar el contenido.");
  if (!deleted?.length) throw new AdminOpError("NOT_FOUND", "El contenido no existe.");
  await logAdminAction(supabase, { action: "content.delete", targetTable: "content_pages", targetId: id, metadata: { kind: deleted[0].kind } });
}

/**
 * Sube o baja un contenido dentro de su tipo. Renumera el tipo completo (10, 20, 30…) para que el
 * orden quede estable aunque hubiera empates.
 */
export async function moveContentPage(supabase: Db, data: z.output<typeof contentMoveSchema>): Promise<void> {
  const { data: page, error } = await supabase.from("content_pages").select("id, kind").eq("id", data.id).maybeSingle();
  if (error) throw dbError(error, "No se pudo leer el contenido.");
  if (!page) throw new AdminOpError("NOT_FOUND", "El contenido no existe.");
  const { data: siblings, error: listError } = await supabase
    .from("content_pages")
    .select("id, sort_order")
    .eq("kind", page.kind)
    .order("sort_order")
    .order("title");
  if (listError) throw dbError(listError, "No se pudo leer el orden.");
  const ids = (siblings ?? []).map((s) => s.id);
  const reordered = reorder(ids, data.id, data.direction);
  if (!reordered) return;
  const current = new Map((siblings ?? []).map((s) => [s.id, s.sort_order]));
  for (const [index, pageId] of reordered.entries()) {
    const sortOrder = (index + 1) * 10;
    if (current.get(pageId) === sortOrder) continue;
    const { error: upError } = await supabase.from("content_pages").update({ sort_order: sortOrder }).eq("id", pageId);
    if (upError) throw dbError(upError, "No se pudo guardar el orden.");
  }
  await logAdminAction(supabase, { action: "content.reorder", targetTable: "content_pages", targetId: data.id, metadata: { direction: data.direction } });
}

/** Nuevo orden de ids tras mover uno arriba/abajo; null si no se puede mover. */
export function reorder(ids: readonly string[], id: string, direction: "up" | "down"): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
