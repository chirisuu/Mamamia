/**
 * ¿Es una verdura? La tabla `foods` no tiene categoría, así que se reconoce por el NOMBRE guardado
 * en el registro (español o inglés, sin tildes) con una lista propia. Es una aproximación y se dice
 * así en la UI. 1 porción = 80 g (referencia OMS/FAO de frutas y verduras); un día cuenta como «con
 * verduras» desde media porción (40 g), para que una pizca de ajo o culantro no sume.
 */
import { normalizeKey } from "@/lib/nutrition";

export const VEGETABLE_SERVING_G = 80;
export const VEGETABLE_DAY_MIN_SERVINGS = 0.5;

const VEGETABLE_KEYWORDS = [
  // Español (Perú y Latinoamérica)
  "verdura",
  "vegetal",
  "hortaliza",
  "lechuga",
  "tomate",
  "cebolla",
  "cebolla china",
  "zanahoria",
  "brocoli",
  "espinaca",
  "zapallo",
  "zapallito",
  "calabaza",
  "calabacin",
  "vainita",
  "pepino",
  "beterraga",
  "betarraga",
  "remolacha",
  "pimiento",
  "coliflor",
  "repollo",
  "col",
  "apio",
  "champinon",
  "hongo",
  "berenjena",
  "acelga",
  "alcachofa",
  "esparrago",
  "rabanito",
  "rabano",
  "nabo",
  "poro",
  "puerro",
  "caigua",
  "vainas",
  "kale",
  "arugula",
  "rucula",
  "nabo",
  // Inglés (nombres de USDA)
  "vegetable",
  "lettuce",
  "tomato",
  "onion",
  "carrot",
  "broccoli",
  "spinach",
  "squash",
  "zucchini",
  "green bean",
  "snap bean",
  "cucumber",
  "beet",
  "bell pepper",
  "sweet pepper",
  "cauliflower",
  "cabbage",
  "celery",
  "mushroom",
  "eggplant",
  "chard",
  "asparagus",
  "artichoke",
  "radish",
  "leek",
  "pumpkin",
  "arugula",
] as const;

/** Si el nombre tiene alguna de estas palabras, no se cuenta (salsas, snacks, postres, frutas). */
const EXCLUDE_KEYWORDS = [
  "salsa",
  "ketchup",
  "sauce",
  "pasta de tomate",
  "chips",
  "snack",
  "torta",
  "queque",
  "cake",
  "fruta",
  "fruit",
  "mermelada",
  "jam",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toPattern = (words: readonly string[]) => new RegExp(`\\b(?:${[...new Set(words)].map(escape).join("|")})(?:s|es)?\\b`);

const INCLUDE = toPattern(VEGETABLE_KEYWORDS);
const EXCLUDE = toPattern(EXCLUDE_KEYWORDS);

export function isVegetableName(name: string | null | undefined): boolean {
  if (!name) return false;
  const key = normalizeKey(name);
  return INCLUDE.test(key) && !EXCLUDE.test(key);
}

/** Porciones de verdura de una lista de ítems (gramos de los que se reconocen como verdura / 80). */
export function vegetableServings(items: readonly { name: string | null; grams: number | null }[]): number {
  const grams = items.reduce((s, i) => (isVegetableName(i.name) && i.grams && i.grams > 0 ? s + Number(i.grams) : s), 0);
  const servings = grams / VEGETABLE_SERVING_G;
  return servings < VEGETABLE_DAY_MIN_SERVINGS ? 0 : Math.round(servings * 10) / 10;
}
