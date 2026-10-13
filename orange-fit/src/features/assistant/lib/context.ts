/**
 * Contexto MÍNIMO que se comparte con el asistente: objetivo, meta vigente y totales de hoy,
 * más el cupo del plan. Nunca fotos, nombres, peso, condiciones de salud en detalle ni datos de
 * terceros. Con antecedente de TCA, revisión profesional pendiente o una conversación marcada,
 * se omiten las cifras de calorías y se activa el "modo cuidado". Puro y probado.
 */
import { formatNumber } from "@/lib/format";

export type GoalTypeValue = "lose_fat" | "gain_muscle" | "maintain" | "recomposition" | "improve_habits";

export const GOAL_LABELS: Record<GoalTypeValue, string> = {
  lose_fat: "bajar grasa",
  gain_muscle: "ganar músculo",
  maintain: "mantener su peso",
  recomposition: "recomposición corporal",
  improve_habits: "mejorar hábitos",
};

export type AssistantContextInput = {
  today: string;
  goalType: GoalTypeValue | null;
  targets: {
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    waterMl: number | null;
  } | null;
  consumed: {
    energyKcal: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    itemsCount: number;
  } | null;
  quota: { used: number; limit: number } | null;
  safety: {
    /** `user_goals.health_flags` incluye eating_disorder_history. */
    eatingDisorderHistory: boolean;
    /** `user_goals.requires_professional_review` (perfil que requiere acompañamiento). */
    professionalReview: boolean;
    /** Esta conversación ya tuvo un mensaje marcado por la moderación. */
    flaggedConversation: boolean;
  };
};

export function isCareMode(safety: AssistantContextInput["safety"]): boolean {
  return safety.eatingDisorderHistory || safety.flaggedConversation;
}

const g = (v: number) => `${formatNumber(v)} g`;

export function buildAssistantContext(input: AssistantContextInput): string {
  const careMode = isCareMode(input.safety);
  const lines: string[] = [`- Fecha de hoy (su zona horaria): ${input.today}.`];
  lines.push(`- Objetivo declarado: ${input.goalType ? GOAL_LABELS[input.goalType] : "no definido"}.`);

  if (input.targets) {
    const t = input.targets;
    const macros = `proteína ${g(t.proteinG)}, carbohidratos ${g(t.carbsG)}, grasas ${g(t.fatG)}${t.fiberG != null ? `, fibra ${g(t.fiberG)}` : ""}`;
    lines.push(careMode ? `- Meta diaria vigente (sin cifras de calorías por cuidado): ${macros}.` : `- Meta diaria vigente: ${formatNumber(t.energyKcal)} kcal; ${macros}.`);
    if (t.waterMl != null) lines.push(`- Meta de agua: ${formatNumber(t.waterMl)} ml.`);
  } else {
    lines.push("- Meta diaria: aún no definida (puede definirla en Perfil > Metas).");
  }

  if (input.consumed && input.consumed.itemsCount > 0) {
    const c = input.consumed;
    const macros = `proteína ${g(c.proteinG)}, carbohidratos ${g(c.carbsG)}, grasas ${g(c.fatG)}${c.fiberG != null ? `, fibra ${g(c.fiberG)}` : ""}`;
    lines.push(
      careMode
        ? `- Registrado hoy (${c.itemsCount} alimentos): ${macros}.`
        : `- Registrado hoy (${c.itemsCount} alimentos): ${formatNumber(c.energyKcal)} kcal; ${macros}.`,
    );
    if (!careMode && input.targets) {
      const remaining = Math.round(input.targets.energyKcal - c.energyKcal);
      lines.push(
        remaining >= 0
          ? `- Le quedan ${formatNumber(remaining)} kcal para su meta de hoy.`
          : `- Hoy va ${formatNumber(-remaining)} kcal sobre su meta (es información, no un fracaso).`,
      );
    }
  } else {
    lines.push("- Registrado hoy: todavía nada.");
  }

  if (input.quota) {
    const left = Math.max(0, input.quota.limit - input.quota.used);
    lines.push(`- Mensajes del asistente que le quedan este mes: ${formatNumber(left)} de ${formatNumber(input.quota.limit)}.`);
  }

  const rules: string[] = [];
  if (careMode) {
    rules.push(
      "MODO CUIDADO: no menciones calorías, déficit, pérdida de peso, conteo estricto ni restricción. Enfócate en comidas regulares, variedad, saciedad y bienestar. Sugiere con calidez el acompañamiento de un profesional y, si hay malestar, la Línea 113, opción 5 (salud mental del MINSA).",
    );
  } else if (input.safety.professionalReview) {
    rules.push(
      "Su perfil indica que conviene acompañamiento profesional: no propongas déficits ni cambios de meta; sugiere revisarlo con un profesional de salud.",
    );
  }

  return [
    "Contexto autorizado de la persona (es todo lo que sabes de ella; no tienes acceso a otros datos, fotos ni datos de terceros):",
    ...lines,
    ...(rules.length ? ["", ...rules] : []),
  ].join("\n");
}
