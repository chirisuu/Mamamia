import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";
import { listFilesRecursive } from "./storage-files";

type Client = SupabaseClient<Database>;
type TableName = keyof Database["public"]["Tables"];

/** Tablas propias: columna del dueño y orden estable para paginar. */
const OWNED_TABLES: ReadonlyArray<{ table: TableName; owner: string; order: string; select?: string }> = [
  { table: "user_roles", owner: "user_id", order: "role" },
  { table: "consents", owner: "user_id", order: "created_at" },
  { table: "user_goals", owner: "user_id", order: "created_at" },
  { table: "nutrition_targets", owner: "user_id", order: "created_at" },
  { table: "meal_logs", owner: "user_id", order: "id" },
  { table: "meal_log_items", owner: "user_id", order: "id" },
  { table: "meal_templates", owner: "user_id", order: "id" },
  { table: "meal_template_items", owner: "user_id", order: "id" },
  { table: "user_favorites", owner: "user_id", order: "id" },
  { table: "recipes", owner: "owner_id", order: "id" },
  { table: "foods", owner: "created_by", order: "id" },
  { table: "meal_plans", owner: "user_id", order: "id" },
  { table: "meal_plan_items", owner: "user_id", order: "id" },
  { table: "shopping_lists", owner: "user_id", order: "id" },
  { table: "shopping_list_items", owner: "user_id", order: "id" },
  { table: "water_logs", owner: "user_id", order: "id" },
  { table: "weight_logs", owner: "user_id", order: "id" },
  { table: "body_measurements", owner: "user_id", order: "id" },
  { table: "progress_photos", owner: "user_id", order: "id" },
  { table: "fasting_sessions", owner: "user_id", order: "id" },
  { table: "exercise_logs", owner: "user_id", order: "id" },
  { table: "assistant_conversations", owner: "user_id", order: "id" },
  { table: "assistant_messages", owner: "user_id", order: "id" },
  { table: "ai_analysis_requests", owner: "user_id", order: "id" },
  { table: "notifications", owner: "user_id", order: "id" },
  { table: "user_badges", owner: "user_id", order: "earned_at" },
  { table: "user_challenges", owner: "user_id", order: "id" },
  // Sin claves de cifrado del navegador: solo cuándo se activaron las notificaciones.
  { table: "push_subscriptions", owner: "user_id", order: "id", select: "id, created_at" },
  // Sin identificadores del proveedor de pagos (no sirven al usuario y son sensibles).
  {
    table: "subscriptions",
    owner: "user_id",
    order: "id",
    select: "id, plan_id, provider, status, current_period_start, current_period_end, trial_end, cancel_at_period_end, canceled_at, created_at, updated_at",
  },
  { table: "payments", owner: "user_id", order: "id", select: "id, subscription_id, provider, amount_cents, currency_code, status, paid_at, created_at" },
];

const PAGE = 1000;
const SIGNED_URL_SECONDS = 60 * 60;

export class ExportError extends Error {
  constructor(readonly section: string) {
    super(`export_failed:${section}`);
    this.name = "ExportError";
  }
}

// La API tipada de supabase-js no acepta nombres de tabla dinámicos; para leer filas tal cual
// usamos el cliente sin tipos (los datos solo se serializan).
type LooseClient = { from: (table: string) => { select: (cols: string) => LooseQuery } };
type LooseQuery = {
  eq: (col: string, v: string) => LooseQuery;
  in: (col: string, v: string[]) => LooseQuery;
  order: (col: string, o: { ascending: boolean }) => LooseQuery;
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
};

async function fetchAll(
  supabase: Client,
  table: string,
  filter: { column: string; values: string | string[] },
  order: string,
  select = "*",
): Promise<unknown[]> {
  const loose = supabase as unknown as LooseClient;
  const rows: unknown[] = [];
  // Listas de ids en grupos de 100 para no armar URLs enormes.
  const groups = Array.isArray(filter.values)
    ? Array.from({ length: Math.ceil(filter.values.length / 100) }, (_, i) => (filter.values as string[]).slice(i * 100, i * 100 + 100))
    : [filter.values];
  for (const value of groups) {
    for (let from = 0; ; from += PAGE) {
      let query = loose.from(table).select(select);
      query = Array.isArray(value) ? query.in(filter.column, value) : query.eq(filter.column, value);
      const { data, error } = await query.order(order, { ascending: true }).range(from, from + PAGE - 1);
      if (error) throw new ExportError(table);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
  }
  return rows;
}

const idsOf = (rows: unknown[]) => rows.map((r) => (r as { id: string }).id);

/**
 * Exporta TODOS los datos de la persona (derecho de acceso y portabilidad). Usa su propia sesión:
 * RLS garantiza que no se cuele nada ajeno, y además cada consulta filtra por su id (las políticas
 * de profesionales/admin podrían mostrar filas de otras personas).
 */
export async function buildAccountExport(supabase: Client, user: User, now: Date = new Date()) {
  const uid = user.id;
  const tables: Record<string, unknown[]> = {};

  const profile = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
  if (profile.error) throw new ExportError("profiles");

  for (const spec of OWNED_TABLES) {
    tables[spec.table] = await fetchAll(supabase, spec.table, { column: spec.owner, values: uid }, spec.order, spec.select);
  }

  // Detalle de lo propio que vive en tablas compartidas.
  const recipeIds = idsOf(tables.recipes ?? []);
  tables.recipe_ingredients = await fetchAll(supabase, "recipe_ingredients", { column: "recipe_id", values: recipeIds }, "id");
  const foodIds = idsOf(tables.foods ?? []);
  tables.food_portions = await fetchAll(supabase, "food_portions", { column: "food_id", values: foodIds }, "id");
  tables.food_nutrients = await fetchAll(supabase, "food_nutrients", { column: "food_id", values: foodIds }, "nutrient_id");

  // Accesos profesionales: los que diste y, si eres profesional, los que recibiste (sin ids ajenos).
  tables.professional_access_granted = await fetchAll(
    supabase,
    "professional_access",
    { column: "user_id", values: uid },
    "granted_at",
    "id, scope, granted_at, revoked_at",
  );
  tables.professional_access_received = await fetchAll(
    supabase,
    "professional_access",
    { column: "professional_id", values: uid },
    "granted_at",
    "id, scope, granted_at, revoked_at",
  );

  // Archivos: URL firmadas de 1 h (buckets privados) o públicas (imágenes de recetas).
  const progressPaths = [
    ...new Set([
      ...(tables.progress_photos ?? []).map((r) => (r as { storage_path: string }).storage_path),
      ...(await listOrThrow(supabase, "progress-photos", uid)),
    ]),
  ];
  const files = {
    progress_photos: await signedUrls(supabase, "progress-photos", progressPaths),
    meal_photos: await signedUrls(supabase, "meal-photos", await listOrThrow(supabase, "meal-photos", uid)),
    recipe_images: (await listOrThrow(supabase, "recipe-images", uid)).map((path) => ({
      path,
      url: supabase.storage.from("recipe-images").getPublicUrl(path).data.publicUrl,
    })),
  };

  const generatedAt = now.toISOString();
  return {
    _meta: {
      format: "orange-fit-export",
      version: 1,
      generated_at: generatedAt,
      signed_urls_expire_at: new Date(now.getTime() + SIGNED_URL_SECONDS * 1000).toISOString(),
      notes: [
        "Incluye todos tus datos guardados en la app. Los enlaces a fotos vencen en 1 hora: descárgalas antes.",
        "Por seguridad no se incluyen identificadores de pago del proveedor, ni las claves de tus suscripciones a notificaciones.",
      ],
    },
    account: {
      id: uid,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      email_confirmed_at: user.email_confirmed_at ?? null,
    },
    profile: profile.data,
    ...tables,
    files,
  };
}

async function listOrThrow(supabase: Client, bucket: string, uid: string): Promise<string[]> {
  try {
    return await listFilesRecursive(supabase, bucket, uid);
  } catch {
    throw new ExportError(`storage:${bucket}`);
  }
}

async function signedUrls(supabase: Client, bucket: string, paths: string[]) {
  const out: Array<{ path: string; url: string | null }> = [];
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100);
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(chunk, SIGNED_URL_SECONDS);
    if (error) throw new ExportError(`storage:${bucket}`);
    for (const item of data ?? []) out.push({ path: item.path ?? "", url: item.error ? null : item.signedUrl });
  }
  return out;
}

export function exportFilename(localDate: string): string {
  return `orange-fit-mis-datos-${localDate}.json`;
}
