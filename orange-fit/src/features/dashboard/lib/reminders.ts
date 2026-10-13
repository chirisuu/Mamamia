/**
 * Recordatorios calculados para Inicio a partir de la hora LOCAL y de los registros reales.
 * Honestos (solo si de verdad falta algo) y amables: nunca culpan. Puro y probado.
 */
import { diffDays } from "@/lib/dates";
import { formatMl } from "@/lib/format";
import type { MealType } from "@/features/diary/types";

export type Reminder = {
  id: "meal" | "water" | "weight" | "target";
  title: string;
  body: string;
  href: string;
  actionLabel: string;
};

export type ReminderInput = {
  /** Hora local 0–23. */
  hour: number;
  today: string;
  /** Comidas con al menos un ítem hoy. */
  loggedMeals: readonly MealType[];
  waterMl: number;
  waterTargetMl: number | null;
  lastWeightDate: string | null;
  /** false con antecedente de TCA: no se insiste con el peso. */
  showWeightReminders: boolean;
  hasTarget: boolean;
};

const MEAL_COPY = {
  breakfast: { name: "el desayuno", verb: "desayunaste" },
  lunch: { name: "el almuerzo", verb: "almorzaste" },
  dinner: { name: "la cena", verb: "cenaste" },
} as const;

/** La comida principal que ya pasó y no tiene registros (solo una, para no saturar). */
export function pendingMeal(hour: number, logged: readonly MealType[]): keyof typeof MEAL_COPY | null {
  const has = (m: MealType) => logged.includes(m);
  if (hour >= 21 && !has("dinner")) return "dinner";
  if (hour >= 15 && hour < 21 && !has("lunch") && !has("dinner")) return "lunch";
  if (hour >= 10 && hour < 15 && !has("breakfast") && !has("lunch")) return "breakfast";
  return null;
}

export function computeReminders(input: ReminderInput): Reminder[] {
  const out: Reminder[] = [];
  if (!input.hasTarget) {
    out.push({
      id: "target",
      title: "Aún no tienes una meta diaria",
      body: "Con tu meta podemos mostrarte cuánto te queda y cómo vas con tus macros.",
      href: "/app/perfil/metas",
      actionLabel: "Definir mi meta",
    });
  }
  const meal = pendingMeal(input.hour, input.loggedMeals);
  if (meal) {
    const copy = MEAL_COPY[meal];
    out.push({
      id: "meal",
      title: `Aún no registras ${copy.name}`,
      body: `Si ya ${copy.verb}, regístralo ahora que lo recuerdas. Si no, no pasa nada.`,
      href: `/app/agregar/buscar?comida=${meal}`,
      actionLabel: "Registrar",
    });
  }
  if (input.hour >= 14 && input.waterTargetMl && input.waterTargetMl > 0 && input.waterMl < input.waterTargetMl * 0.5) {
    out.push({
      id: "water",
      title: `Llevas ${formatMl(input.waterMl)} de ${formatMl(input.waterTargetMl)} de agua`,
      body: "Un vaso ahora te acerca a tu meta del día.",
      href: "/app/agua",
      actionLabel: "Registrar agua",
    });
  }
  if (input.showWeightReminders) {
    const days = input.lastWeightDate ? diffDays(input.lastWeightDate, input.today) : null;
    if (days == null || days >= 7) {
      out.push({
        id: "weight",
        title: days == null ? "Aún no registras tu peso" : `Tu último pesaje fue hace ${days} días`,
        body: "Con pesarte una o dos veces por semana basta para ver tu tendencia; el número de un día no lo dice todo.",
        href: "/app/progreso",
        actionLabel: "Ir a progreso",
      });
    }
  }
  return out;
}
