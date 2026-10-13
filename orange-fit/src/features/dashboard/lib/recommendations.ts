/**
 * Sugerencias basadas en reglas simples sobre los registros del usuario. Se muestran como
 * "sugerencias" (no indicaciones médicas), sin culpa y sin prometer resultados. Puro y probado.
 */
import { formatGrams, formatNumber } from "@/lib/format";

/** OMS: menos de 2 g de sodio al día para adultos (≈ 5 g de sal). */
export const WHO_SODIUM_LIMIT_MG = 2000;

export type RecipeSuggestion = { title: string; slug: string; proteinG: number; energyKcal: number };

export type Recommendation = {
  id: "low_intake" | "protein" | "fiber" | "sodium" | "consistency";
  title: string;
  body: string;
  links: Array<{ href: string; label: string }>;
};

export type RecommendationInput = {
  hour: number;
  today: {
    itemsCount: number;
    energyKcal: number;
    proteinG: number;
    fiberG: number | null;
    sodiumMg: number | null;
    incomplete: readonly string[];
  };
  yesterday: { logged: boolean; proteinG: number } | null;
  target: { energyKcal: number; proteinG: number; fiberG: number | null } | null;
  /** Días con registro en los últimos 7 (sin contar hoy). */
  daysLoggedLast7: number;
  isNewUser: boolean;
  highProteinRecipes: readonly RecipeSuggestion[];
};

export const MAX_RECOMMENDATIONS = 3;

export function computeRecommendations(input: RecommendationInput): Recommendation[] {
  const out: Recommendation[] = [];
  const { today, target } = input;

  // 1. Comer muy poco no ayuda: se dice con cuidado y solo al final del día.
  if (target && input.hour >= 20 && today.itemsCount > 0 && today.energyKcal < target.energyKcal * 0.5) {
    out.push({
      id: "low_intake",
      title: "Tu registro de hoy va bastante por debajo de tu meta",
      body: "Si comiste algo más, regístralo. Si no, considera una cena completa: comer muy poco no acelera tus resultados y te quita energía.",
      links: [{ href: "/app/agregar/buscar?comida=dinner", label: "Registrar cena" }],
    });
  }

  // 2. Proteína baja hoy (desde media tarde) o ayer.
  if (target && target.proteinG > 0) {
    const lowToday = input.hour >= 15 && today.itemsCount > 0 && today.proteinG < target.proteinG * 0.4;
    const lowYesterday = !lowToday && input.yesterday?.logged === true && input.yesterday.proteinG < target.proteinG * 0.8;
    if (lowToday || lowYesterday) {
      const amount = lowToday ? today.proteinG : input.yesterday!.proteinG;
      out.push({
        id: "protein",
        title: "Suma proteína en tu próxima comida",
        body: `${lowToday ? "Llevas" : "Ayer llegaste a"} ${formatGrams(amount)} de ${formatGrams(target.proteinG)} de proteína. Huevo, pollo, pescado, menestras o yogur natural son opciones fáciles.`,
        links: [
          ...input.highProteinRecipes.slice(0, 2).map((r) => ({
            href: `/app/recetas/${r.slug}`,
            label: `${r.title} · ${formatGrams(r.proteinG)} de proteína`,
          })),
          { href: "/app/recetas", label: "Ver recetas" },
        ],
      });
    }
  }

  // 3. Fibra baja (solo si el dato está completo: si falta en algún alimento no lo sabemos).
  if (
    target?.fiberG &&
    input.hour >= 16 &&
    today.itemsCount > 0 &&
    today.fiberG != null &&
    !today.incomplete.includes("fiberG") &&
    today.fiberG < target.fiberG * 0.4
  ) {
    out.push({
      id: "fiber",
      title: "Agrega verduras, frutas o menestras",
      body: `Llevas ${formatGrams(today.fiberG)} de ${formatGrams(target.fiberG)} de fibra. Una ensalada o una porción de menestras en la cena suman bastante.`,
      links: [{ href: "/app/recetas", label: "Ver recetas" }],
    });
  }

  // 4. Sodio por encima de la recomendación de la OMS.
  if (today.sodiumMg != null && today.sodiumMg > WHO_SODIUM_LIMIT_MG) {
    const atLeast = today.incomplete.includes("sodiumMg") ? "al menos " : "";
    out.push({
      id: "sodium",
      title: `Hoy llevas ${atLeast}${formatNumber(today.sodiumMg)} mg de sodio`,
      body: `La OMS recomienda no pasar de ${formatNumber(WHO_SODIUM_LIMIT_MG)} mg al día. Para lo que queda, prefiere preparaciones caseras y menos embutidos o snacks salados.`,
      links: [],
    });
  }

  // 5. Constancia, sin presión.
  if (!input.isNewUser && input.daysLoggedLast7 <= 2) {
    out.push({
      id: "consistency",
      title: "Registrar una comida al día ya ayuda",
      body: "No necesitas registrarlo todo perfecto: con una comida al día empiezas a ver tus patrones.",
      links: [{ href: "/app/agregar", label: "Registrar algo" }],
    });
  }

  return out.slice(0, MAX_RECOMMENDATIONS);
}

/** Elige recetas con más proteína por caloría (mínimo 20 g por porción). */
export function pickHighProteinRecipes(
  rows: ReadonlyArray<{ title: string; slug: string; proteinG: number | null; energyKcal: number | null }>,
  limit = 3,
): RecipeSuggestion[] {
  return rows
    .flatMap((r) =>
      r.proteinG != null && r.energyKcal != null && r.energyKcal > 0 && r.proteinG >= 20
        ? [{ title: r.title, slug: r.slug, proteinG: Math.round(r.proteinG), energyKcal: Math.round(r.energyKcal) }]
        : [],
    )
    .sort((a, b) => b.proteinG / b.energyKcal - a.proteinG / a.energyKcal)
    .slice(0, limit);
}
