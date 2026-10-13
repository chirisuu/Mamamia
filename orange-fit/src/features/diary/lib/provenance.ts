/**
 * Texto de procedencia de un ítem del diario: de dónde salen sus nutrientes y si es una
 * estimación (IA o valores escritos a mano). Puro y probado.
 */
import { provenanceLabel, type FoodSummary } from "@/lib/foods/types";
import type { LogSource } from "../types";

const FOOD_SOURCES = new Set<FoodSummary["source"]>(["usda", "open_food_facts", "curated", "user", "admin"]);
const VERIFICATION = new Set<FoodSummary["verificationStatus"]>(["unverified", "curated", "verified", "rejected"]);

const AI_LABELS: Partial<Record<LogSource, string>> = {
  photo_ai: "foto",
  voice_ai: "voz",
  text_ai: "texto",
};

export type ProvenanceInput = {
  source: LogSource;
  dataProvenance: string | null;
  isEstimate: boolean;
  confidence: number | null;
};

/** Origen base (sin la parte de IA) a partir del alimento vigente o del texto guardado al registrar. */
export function baseProvenance(
  dataProvenance: string | null,
  food?: Pick<FoodSummary, "source" | "verificationStatus"> | null,
): string {
  if (food) return provenanceLabel(food);
  const raw = (dataProvenance ?? "").trim();
  if (!raw) return "Procedencia no registrada";
  if (raw === "user_entered") return "Valores ingresados por ti";
  if (raw.startsWith("recipe:")) return "Receta · calculada desde sus ingredientes";
  const head = raw.split(" · ")[0] ?? "";
  const [source, status] = head.split(":");
  if (source && status && FOOD_SOURCES.has(source as FoodSummary["source"]) && VERIFICATION.has(status as FoodSummary["verificationStatus"])) {
    return provenanceLabel({ source: source as FoodSummary["source"], verificationStatus: status as FoodSummary["verificationStatus"] });
  }
  return "Procedencia no registrada";
}

export function itemProvenance(
  item: ProvenanceInput,
  food?: Pick<FoodSummary, "source" | "verificationStatus"> | null,
): { label: string; isAi: boolean; isEstimate: boolean } {
  const base = baseProvenance(item.dataProvenance, food);
  const aiKind = AI_LABELS[item.source];
  if (aiKind) {
    const pct = item.confidence != null ? ` (confianza ${Math.round(item.confidence * 100)} %)` : "";
    return { label: `Estimación con IA por ${aiKind}${pct} · ${base}`, isAi: true, isEstimate: true };
  }
  if (item.isEstimate) {
    return { label: base === "Valores ingresados por ti" ? "Estimación ingresada por ti" : `Estimación · ${base}`, isAi: false, isEstimate: true };
  }
  return { label: base, isAi: false, isEstimate: false };
}
