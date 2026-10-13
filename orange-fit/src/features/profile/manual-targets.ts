/**
 * Revisión de una meta escrita a mano (por la persona o por su profesional). Respeta los pisos
 * de `targets.ts` y los bloqueos de `risk.ts`: bajo el piso o con déficit bloqueado, la persona no
 * puede guardar; el profesional sí, pero con advertencia explícita (es quien supervisa).
 */
import { z } from "zod";
import { MAX_DEFICIT_FRACTION_OF_TDEE, MIN_ENERGY_KCAL, type Sex } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";

export const manualTargetsSchema = z.object({
  energyKcal: z.number("Indica las calorías.").int("Usa un número entero.").min(500, "El mínimo es 500 kcal.").max(10000, "El máximo es 10,000 kcal."),
  proteinG: z.number("Indica la proteína.").int("Usa un número entero.").min(0).max(1000, "El máximo es 1000 g."),
  carbsG: z.number("Indica los carbohidratos.").int("Usa un número entero.").min(0).max(2000, "El máximo es 2000 g."),
  fatG: z.number("Indica la grasa.").int("Usa un número entero.").min(0).max(1000, "El máximo es 1000 g."),
  fiberG: z.number().int("Usa un número entero.").min(0).max(200, "El máximo es 200 g.").nullable(),
  waterMl: z.number().int("Usa un número entero.").min(0).max(10000, "El máximo es 10,000 ml.").nullable(),
  notes: z.string().trim().max(2000, "Usa como máximo 2000 caracteres.").nullable(),
});
export type ManualTargetsValues = z.output<typeof manualTargetsSchema>;

export type ManualTargetsContext = {
  sex: Sex | null;
  bmr: number | null;
  tdee: number | null;
  /** risk.blocks.calorieDeficit */
  deficitBlocked: boolean;
  /** risk.blocks.aggressiveGoals */
  cautious: boolean;
};

export type ReviewIssue = { code: string; field: keyof ManualTargetsValues | null; message: string };

export type ManualReview = { errors: ReviewIssue[]; warnings: ReviewIssue[] };

const MACRO_TOLERANCE = 0.1;
const CAUTIOUS_SURPLUS = 0.1;
const LARGE_SURPLUS = 0.2;

export function manualFloor(sex: Sex | null): number {
  // Sin sexo registrado usamos el piso más alto: es lo más prudente.
  return sex ? MIN_ENERGY_KCAL[sex] : Math.max(MIN_ENERGY_KCAL.female, MIN_ENERGY_KCAL.male);
}

export function reviewManualTargets(
  values: Pick<ManualTargetsValues, "energyKcal" | "proteinG" | "carbsG" | "fatG">,
  ctx: ManualTargetsContext,
  opts: { byProfessional?: boolean } = {},
): ManualReview {
  const errors: ReviewIssue[] = [];
  const warnings: ReviewIssue[] = [];
  const pushBlocking = (issue: ReviewIssue) => (opts.byProfessional ? warnings : errors).push(issue);
  const kcal = values.energyKcal;
  const floor = manualFloor(ctx.sex);

  if (kcal < floor) {
    pushBlocking({
      code: "below_floor",
      field: "energyKcal",
      message: opts.byProfessional
        ? `Está por debajo del piso de ${formatNumber(floor)} kcal que usamos sin supervisión. Confírmalo solo si haces el seguimiento.`
        : `No podemos guardar metas por debajo de ${formatNumber(floor)} kcal sin supervisión profesional.`,
    });
  } else if (ctx.deficitBlocked && ctx.tdee != null && kcal < ctx.tdee) {
    pushBlocking({
      code: "deficit_blocked",
      field: "energyKcal",
      message: opts.byProfessional
        ? `El perfil de esta persona no admite déficit sin supervisión (su gasto estimado es ${formatNumber(ctx.tdee)} kcal).`
        : `Por tu perfil de salud no aplicamos déficit: la meta no puede bajar de tu gasto estimado (${formatNumber(ctx.tdee)} kcal) sin un profesional.`,
    });
  }

  if (ctx.bmr != null && kcal < ctx.bmr && kcal >= floor) {
    warnings.push({
      code: "below_bmr",
      field: "energyKcal",
      message: `Está por debajo del metabolismo basal estimado (${formatNumber(ctx.bmr)} kcal). Comer menos que eso por mucho tiempo no es recomendable.`,
    });
  }
  if (ctx.tdee != null && kcal < ctx.tdee * (1 - MAX_DEFICIT_FRACTION_OF_TDEE)) {
    warnings.push({
      code: "large_deficit",
      field: "energyKcal",
      message: `Es un déficit de más del 25 % del gasto estimado (${formatNumber(ctx.tdee)} kcal): suele ser difícil de sostener.`,
    });
  }
  if (ctx.tdee != null && ctx.cautious && kcal > ctx.tdee * (1 + CAUTIOUS_SURPLUS)) {
    warnings.push({
      code: "cautious_surplus",
      field: "energyKcal",
      message: "Con este perfil recomendamos un superávit de 10 % como máximo.",
    });
  } else if (ctx.tdee != null && kcal > ctx.tdee * (1 + LARGE_SURPLUS)) {
    warnings.push({
      code: "large_surplus",
      field: "energyKcal",
      message: `Supera en más de 20 % el gasto estimado (${formatNumber(ctx.tdee)} kcal).`,
    });
  }

  const macroKcal = 4 * values.proteinG + 4 * values.carbsG + 9 * values.fatG;
  if (kcal > 0 && Math.abs(macroKcal - kcal) / kcal > MACRO_TOLERANCE) {
    warnings.push({
      code: "macro_mismatch",
      field: null,
      message: `Los macros suman ${formatNumber(macroKcal)} kcal (4 × proteína + 4 × carbohidratos + 9 × grasa) y la meta es ${formatNumber(kcal)} kcal.`,
    });
  }

  return { errors, warnings };
}
