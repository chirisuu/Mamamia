/**
 * Cantidad dicha por la persona ("2 tazas", "una palta pequeña", "150 g") → opción del selector
 * de cantidad + gramos, usando SOLO datos del alimento elegido de la base: sus porciones
 * (`food_portions`) y su densidad (`src/lib/nutrition/units.ts`). Si no se puede convertir con
 * datos reales, se piden los gramos (nunca se asume una densidad ni un peso). Puro y probado.
 */
import { buildAmountOptions, gramsForAmount, type AmountOption } from "@/features/diary/lib/portion-options";
import type { FoodPortion } from "@/features/diary/types";
import { isMassUnit, MASS_UNITS, normalizeUnit, tryToGrams } from "@/lib/nutrition";
import { formatNumber } from "@/lib/format";

export type AmountFood = { portions: readonly FoodPortion[]; densityGPerMl: number | null };

export type ResolvedAmount = {
  optionKey: string;
  /** Cantidad en la unidad de la opción; null = la persona debe indicarla. */
  amount: number | null;
  grams: number | null;
  /** stated: dijo los gramos · mass: unidad de masa · portion: porción del alimento ·
   *  volume: volumen con densidad · approx: porción de otro tamaño · needs_grams: no se pudo. */
  status: "stated" | "mass" | "portion" | "volume" | "approx" | "needs_grams";
  note: string | null;
};

const SIZE_WORDS = ["pequena", "pequeno", "chica", "chico", "mediana", "mediano", "grande"] as const;

function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Separa "unidad pequeña" en unidad base + tamaño. */
export function splitSize(unit: string): { base: string; size: string | null } {
  const words = fold(unit).split(" ");
  const size = words.find((w) => (SIZE_WORDS as readonly string[]).includes(w)) ?? null;
  const base = words.filter((w) => w !== size && w !== "de").join(" ").trim();
  return { base: base || "unidad", size };
}

function gramsOption(options: readonly AmountOption[]): AmountOption {
  return options.find((o) => o.key === "g")!;
}

/** Porción cuya unidad (o etiqueta) coincide con la unidad dicha, preferentemente del mismo tamaño. */
function findPortion(portions: readonly FoodPortion[], unit: string): { portion: FoodPortion; exactSize: boolean } | null {
  const { base, size } = splitSize(unit);
  const baseKey = normalizeUnit(base);
  const sameUnit = portions.filter((p) => normalizeUnit(p.unit) === baseKey || normalizeUnit(splitSize(p.unit).base) === baseKey);
  if (!sameUnit.length) return null;
  if (size) {
    const sized = sameUnit.find((p) => fold(`${p.label} ${p.unit}`).includes(size.slice(0, 5)));
    if (sized) return { portion: sized, exactSize: true };
    return { portion: sameUnit.find((p) => p.isDefault) ?? sameUnit[0]!, exactSize: false };
  }
  const plain = sameUnit.find((p) => !SIZE_WORDS.some((w) => fold(`${p.label} ${p.unit}`).includes(w.slice(0, 5))));
  return { portion: plain ?? sameUnit.find((p) => p.isDefault) ?? sameUnit[0]!, exactSize: Boolean(plain) };
}

export function resolveSpokenAmount(
  spoken: { quantity: number; unit: string; gramsIfStated: number | null },
  food: AmountFood,
): ResolvedAmount {
  const options = buildAmountOptions(food);
  const g = gramsOption(options);

  if (spoken.gramsIfStated != null && spoken.gramsIfStated > 0) {
    const grams = Math.min(5000, round2(spoken.gramsIfStated));
    return { optionKey: "g", amount: grams, grams, status: "stated", note: null };
  }

  const quantity = Number.isFinite(spoken.quantity) && spoken.quantity > 0 ? spoken.quantity : 1;
  const unitKey = normalizeUnit(spoken.unit);

  if (isMassUnit(unitKey)) {
    const grams = Math.min(5000, round2(quantity * MASS_UNITS[unitKey].grams));
    return { optionKey: g.key, amount: grams, grams, status: "mass", note: null };
  }

  const match = findPortion(food.portions, spoken.unit);
  if (match) {
    const option = options.find((o) => o.key === `p:${match.portion.id}`);
    if (option) {
      // La cantidad dicha está en la unidad de la porción ("2 tazas" con la porción "1/2 taza").
      const grams = gramsForAmount(option, quantity);
      if (grams > 0 && grams <= 5000) {
        return {
          optionKey: option.key,
          amount: round2(quantity),
          grams,
          status: match.exactSize ? "portion" : "approx",
          note: match.exactSize
            ? null
            : `No hay una porción «${spoken.unit}» para este alimento: usamos «${match.portion.label}». Ajusta si era de otro tamaño.`,
        };
      }
    }
  }

  // Volumen con densidad registrada (nunca se asume 1 g/ml).
  const conv = tryToGrams(quantity, spoken.unit, { densityGPerMl: food.densityGPerMl });
  if (conv.ok && conv.grams > 0 && conv.grams <= 5000) {
    const ml = options.find((o) => o.key === "ml");
    const grams = round2(conv.grams);
    if (ml && food.densityGPerMl) {
      return { optionKey: "ml", amount: round2(grams / food.densityGPerMl), grams, status: "volume", note: null };
    }
    return { optionKey: g.key, amount: grams, grams, status: "volume", note: null };
  }

  return {
    optionKey: g.key,
    amount: null,
    grams: null,
    status: "needs_grams",
    note: `No sabemos cuánto pesa «${formatNumber(quantity, Number.isInteger(quantity) ? 0 : quantity * 10 === Math.round(quantity * 10) ? 1 : 2)} ${spoken.unit}» de este alimento. Indica los gramos o elige una porción.`,
  };
}
