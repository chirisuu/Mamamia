/**
 * Categoría de compra de un alimento a partir de su nombre. La tabla `foods` no tiene categoría,
 * así que se usa una regla de palabras clave (determinista y probada). Lo desconocido va a "otros".
 */
import { normalizeKey, type ShoppingCategory } from "@/lib/nutrition";

const KEYWORDS: Record<ShoppingCategory, readonly string[]> = {
  other: ["sal", "azucar", "miel", "vinagre", "sillao", "canela", "clavo", "comino", "oregano", "pimienta", "caldo", "agua", "cafe", "te", "cacao", "chocolate", "gelatina", "salsa", "mostaza", "ketchup", "levadura", "polvo de hornear"],
  fats: ["mantequilla de mani", "aceite", "aceituna", "mani", "nuez", "nueces", "almendra", "chia", "linaza", "sesamo", "ajonjoli", "pecana", "castana", "margarina", "mayonesa", "mantequilla", "pasas"],
  protein: [
    "pollo", "pechuga", "gallina", "pavo", "res", "carne", "bistec", "lomo", "cerdo", "chancho", "higado", "corazon", "sangrecita", "salchicha", "jamon",
    "pescado", "jurel", "bonito", "caballa", "perico", "trucha", "merluza", "atun", "pota", "langostino", "camaron", "choro", "choros", "mariscos", "anchoveta",
    "tollo", "huevo", "clara", "tofu", "cuy", "chicharron",
  ],
  dairy: ["leche", "yogurt", "yogur", "queso", "manjar", "kefir", "requeson"],
  legumes: ["lenteja", "frejol", "frijol", "garbanzo", "pallar", "arveja partida", "soya", "tarwi", "chocho"],
  grains_tubers: [
    "arroz", "quinua", "avena", "pan", "fideo", "fideos", "tallarin", "harina", "maiz", "choclo", "cancha", "trigo", "kiwicha", "papa", "camote", "yuca",
    "olluco", "oca", "galleta", "galletas", "tortilla", "mote", "cebada",
  ],
  fruits: [
    "platano", "manzana", "fresa", "mango", "papaya", "pina", "naranja", "mandarina", "uva", "pera", "sandia", "melon", "granadilla", "maracuya", "palta",
    "limon", "aguaymanto", "arandano", "durazno", "kiwi", "lucuma", "chirimoya", "coco", "fruta",
  ],
  vegetables: [
    "cebolla", "tomate", "ajo", "aji", "rocoto", "zanahoria", "brocoli", "espinaca", "lechuga", "pepino", "pimiento", "zapallo", "vainita", "apio",
    "culantro", "perejil", "albahaca", "champinon", "repollo", "coliflor", "beterraga", "caigua", "arveja", "haba", "kion", "jengibre", "huacatay", "poro",
    "acelga", "berenjena", "zucchini", "verdura", "verduras", "hierbabuena",
  ],
};

/** Orden de revisión: lo más específico primero (p. ej. "mantequilla de maní" antes que "mantequilla"). */
const ORDER: readonly ShoppingCategory[] = ["other", "fats", "protein", "dairy", "legumes", "grains_tubers", "fruits", "vegetables"];

const words = (text: string) =>
  normalizeKey(text)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(" ")
    .filter(Boolean);

/** ¿`kw` (una o varias palabras) aparece en `ws` desde la posición `i`, palabra por palabra (admite plural)? */
function matchesAt(ws: readonly string[], i: number, kw: readonly string[]): boolean {
  return kw.every((k, j) => {
    const w = ws[i + j];
    return w !== undefined && (w === k || w === `${k}s` || w === `${k}es`);
  });
}

function categoryOfWords(ws: readonly string[], start: number, end: number): ShoppingCategory | null {
  for (const cat of ORDER) {
    for (const kw of KEYWORDS[cat]) {
      const kws = kw.split(" ");
      for (let i = start; i < end; i++) if (matchesAt(ws, i, kws)) return cat;
    }
  }
  return null;
}

/**
 * Categoría de compra. Primero manda la primera palabra del nombre ("Sillao (salsa de soya)" es un
 * condimento, "Clara de huevo" es proteína); si no dice nada, se mira el resto del nombre.
 */
export function categorizeFood(name: string): ShoppingCategory {
  const ws = words(name);
  if (ws.length === 0) return "other";
  // Frases de varias palabras al inicio ("mantequilla de mani") antes que la primera palabra sola.
  for (const cat of ORDER) {
    for (const kw of KEYWORDS[cat]) {
      const kws = kw.split(" ");
      if (kws.length > 1 && matchesAt(ws, 0, kws)) return cat;
    }
  }
  return categoryOfWords(ws, 0, 1) ?? categoryOfWords(ws, 1, ws.length) ?? "other";
}
