/** Claves de funciones de pago. Los planes en BD (`plans.features`) usan estas mismas claves. */
export const PREMIUM_FEATURES = [
  "ai_photo",
  "ai_voice",
  "ai_text",
  "assistant",
  "meal_plans",
  "smart_recipes",
  "shopping_list",
  "advanced_analytics",
  "exports",
] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

export const FEATURE_LABELS: Record<PremiumFeature, string> = {
  ai_photo: "Registro con foto e IA",
  ai_voice: "Registro por voz",
  ai_text: "Registro escribiendo como hablas",
  assistant: "Asistente nutricional",
  meal_plans: "Planes de comidas",
  smart_recipes: "Recetas inteligentes",
  shopping_list: "Lista de compras",
  advanced_analytics: "Analítica avanzada",
  exports: "Exportaciones (PDF)",
};
