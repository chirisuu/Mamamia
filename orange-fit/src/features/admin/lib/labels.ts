/**
 * Etiquetas y listas del panel admin. Los códigos son los de la base (enums y checks de
 * `docs/DATA_MODEL.md`); aquí solo se traducen para la UI.
 */
import type { Database } from "@/lib/db/database.types";

type Enums = Database["public"]["Enums"];

export const FOOD_SOURCES = ["curated", "admin", "usda", "open_food_facts", "user"] as const satisfies readonly Enums["food_source"][];
/** Fuentes que el staff puede asignar a un alimento del catálogo público ('user' es solo de alimentos propios). */
export const STAFF_FOOD_SOURCES = ["curated", "admin", "usda", "open_food_facts"] as const satisfies readonly Enums["food_source"][];

export const FOOD_SOURCE_LABELS: Record<Enums["food_source"], string> = {
  curated: "Base curada",
  admin: "Equipo editorial",
  usda: "USDA FoodData Central",
  open_food_facts: "Open Food Facts",
  user: "Usuario",
};

export const VERIFICATION_STATUSES = ["unverified", "curated", "verified", "rejected"] as const satisfies readonly Enums["verification_status"][];

export const VERIFICATION_LABELS: Record<Enums["verification_status"], string> = {
  unverified: "Sin verificar",
  curated: "Revisado",
  verified: "Verificado",
  rejected: "Rechazado",
};

export const FOOD_TYPES = ["generic", "branded", "dish"] as const;
export const FOOD_TYPE_LABELS: Record<(typeof FOOD_TYPES)[number], string> = {
  generic: "Genérico",
  branded: "De marca",
  dish: "Plato preparado",
};

export const RECIPE_STATUSES = ["pending_review", "published", "draft", "rejected"] as const satisfies readonly Enums["recipe_status"][];
export const RECIPE_STATUS_LABELS: Record<Enums["recipe_status"], string> = {
  pending_review: "En revisión",
  published: "Publicada",
  draft: "Borrador",
  rejected: "Rechazada",
};

export const CONTENT_KINDS = ["faq", "legal", "landing_block", "article"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const CONTENT_KIND_LABELS: Record<ContentKind, string> = {
  faq: "Pregunta frecuente",
  legal: "Legal",
  landing_block: "Bloque de la landing",
  article: "Artículo",
};

export const CONTENT_STATUSES = ["draft", "published"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const CONTENT_STATUS_LABELS: Record<ContentStatus, string> = { draft: "Borrador", published: "Publicado" };

export const ERROR_STATUSES = ["new", "triaged", "resolved"] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];
export const ERROR_STATUS_LABELS: Record<ErrorStatus, string> = { new: "Nuevo", triaged: "En revisión", resolved: "Resuelto" };

export const ROLE_LABELS: Record<Enums["app_role"], string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  editor: "Editor",
  professional: "Profesional",
};
/** Roles que un superadmin puede otorgar o quitar desde el panel (superadmin solo vía SQL). */
export const GRANTABLE_ROLES = ["editor", "admin", "professional"] as const satisfies readonly Enums["app_role"][];
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const AI_KINDS = ["photo", "text", "voice", "chat", "plan"] as const satisfies readonly Enums["ai_request_kind"][];
export const AI_KIND_LABELS: Record<Enums["ai_request_kind"], string> = {
  photo: "Foto",
  text: "Texto",
  voice: "Voz",
  chat: "Asistente",
  plan: "Planes",
};

export const AI_STATUS_LABELS: Record<Enums["ai_request_status"], string> = {
  pending: "En curso",
  succeeded: "Correctas",
  failed: "Con error",
  rejected_quota: "Sin cupo",
  not_configured: "Sin configurar",
};

export const BILLING_INTERVALS = ["month", "year"] as const satisfies readonly Enums["billing_interval"][];
export const BILLING_INTERVAL_LABELS: Record<Enums["billing_interval"], string> = { month: "Mensual", year: "Anual" };

export const PRICE_UNITS = ["kg", "l", "unit"] as const;
export const PRICE_UNIT_LABELS: Record<(typeof PRICE_UNITS)[number], string> = { kg: "kg", l: "litro", unit: "unidad" };

/** Integraciones de `integrationStatus()` en el orden y con el nombre que ve el staff. */
export const INTEGRATION_LABELS = {
  supabaseAdmin: { label: "Supabase (service role)", hint: "Usuarios, importaciones y tareas de servidor" },
  ai: { label: "IA (Anthropic)", hint: "Foto, texto, asistente" },
  transcription: { label: "Transcripción de voz", hint: "Registro por voz" },
  stripe: { label: "Stripe", hint: "Cobros con tarjeta" },
  mercadopago: { label: "Mercado Pago", hint: "Cobros en Perú" },
  usda: { label: "USDA FoodData Central", hint: "Importar alimentos" },
  push: { label: "Notificaciones push", hint: "Claves VAPID" },
  cron: { label: "Tareas programadas", hint: "CRON_SECRET" },
} as const;

export function labelOf<T extends string>(labels: Record<T, string>, code: string | null | undefined, fallback = "—"): string {
  if (!code) return fallback;
  return (labels as Record<string, string>)[code] ?? code;
}

/** Acciones de `admin_audit_logs` (las que escribe el panel y otros módulos). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "settings.update": "Configuración actualizada",
  "food.create": "Alimento creado",
  "food.update": "Alimento editado",
  "food.verify": "Verificación de alimento",
  "food.merge": "Alimentos fusionados",
  "food.usda_import": "Importación desde USDA",
  "reference_price.create": "Precio referencial creado",
  "reference_price.update": "Precio referencial editado",
  "reference_price.delete": "Precio referencial eliminado",
  "recipe.publish": "Receta publicada",
  "recipe.reject": "Receta rechazada",
  "recipe.create": "Receta oficial creada",
  "recipe.update": "Receta oficial editada",
  "recipe.image_upload": "Imagen de receta subida",
  "recipe.image_remove": "Imagen de receta quitada",
  "content.create": "Contenido creado",
  "content.update": "Contenido editado",
  "content.status": "Contenido publicado/despublicado",
  "content.delete": "Contenido eliminado",
  "content.reorder": "Contenido reordenado",
  "plan.update": "Plan editado",
  "plan_price.create": "Precio de plan creado",
  "plan_price.update": "Precio de plan editado",
  "user_role.grant": "Rol otorgado",
  "user_role.revoke": "Rol quitado",
  "error_report.status": "Estado de error cambiado",
  "account.deleted_by_user": "Cuenta eliminada por su titular",
};

/** Grupos para el filtro de la auditoría (prefijo de la acción). */
export const AUDIT_ACTION_GROUPS = [
  { value: "settings.", label: "Configuración" },
  { value: "food.", label: "Alimentos" },
  { value: "reference_price.", label: "Precios referenciales" },
  { value: "recipe.", label: "Recetas" },
  { value: "content.", label: "Contenidos" },
  { value: "plan", label: "Planes y precios" },
  { value: "user_role.", label: "Roles" },
  { value: "error_report.", label: "Errores" },
  { value: "account.", label: "Cuentas" },
] as const;

export const AUDIT_TABLES = [
  "app_settings",
  "foods",
  "reference_prices",
  "recipes",
  "content_pages",
  "plans",
  "plan_prices",
  "user_roles",
  "error_reports",
  "auth.users",
] as const;

/** Slugs legales que muestra el sitio en /legal/{slug} (src/features/marketing/content.ts). */
export const LEGAL_SLUGS = ["terminos", "privacidad", "datos-de-salud"] as const;

/** Dónde se ve cada tipo de contenido publicado (para no prometer lo que el sitio no muestra). */
export const CONTENT_KIND_HINTS: Record<ContentKind, string> = {
  faq: "Se muestra en /faq (y las primeras en la portada) en el orden indicado. El título es la pregunta.",
  legal: `Se muestra en /legal/{slug}. El sitio solo enlaza estos slugs: ${LEGAL_SLUGS.join(", ")}. En borrador, la página dice «en preparación».`,
  landing_block: "Se guarda y publica, pero hoy ninguna página del sitio lee este tipo.",
  article: "Se guarda y publica, pero hoy ninguna página del sitio lee este tipo.",
};
