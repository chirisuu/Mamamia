/** Slugs de recetas: `^[a-z0-9]+(-[a-z0-9]+)*$`, máx. 180 caracteres (check de la base). */

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Segmentos de ruta propios que no pueden ser slugs (`/app/recetas/nueva`). */
const RESERVED = new Set(["nueva", "editar"]);

export function slugify(text: string, maxLength = 60): string {
  const base = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return base || "receta";
}

/** Sufijo aleatorio corto (base 36) para que dos recetas con el mismo título no choquen. */
export function randomSuffix(length = 6, random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(random() * 36).toString(36);
  return out;
}

export function recipeSlug(title: string, random?: () => number): string {
  const base = slugify(title);
  const slug = `${base}-${randomSuffix(6, random)}`;
  return RESERVED.has(slug) ? `receta-${slug}` : slug;
}

export function isValidSlug(slug: string): boolean {
  return slug.length <= 180 && SLUG_PATTERN.test(slug) && !RESERVED.has(slug);
}
