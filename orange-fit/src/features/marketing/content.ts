import type { PremiumFeature } from "@/lib/billing/features";

/**
 * Contenido fijo del sitio público. Describe lo que la app hace HOY (ver docs/modules/*): nada de
 * cifras de usuarios, testimonios, logos de prensa ni promesas de resultados.
 */

export type FeatureIcon =
  | "search"
  | "camera"
  | "mic"
  | "type"
  | "barcode"
  | "calendar"
  | "chef"
  | "cart"
  | "trending"
  | "timer"
  | "droplet"
  | "sparkles"
  | "activity"
  | "trophy"
  | "bell";

export type MarketingFeature = {
  id: string;
  icon: FeatureIcon;
  title: string;
  description: string;
  /**
   * Clave de `plans.features` que habilita la función. El plan (gratis o Premium) se decide con lo
   * que diga la BD; si no se pudo leer, no se muestra ninguna etiqueta.
   */
  planFeature?: string;
  /** Funciones que la app no restringe por plan. */
  alwaysFree?: boolean;
};

export type FeatureGroup = { id: string; title: string; intro: string; features: MarketingFeature[] };

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: "registrar",
    title: "Registrar lo que comes",
    intro: "Elige la forma más cómoda en cada momento. Todas terminan en tu diario con calorías y macros.",
    features: [
      {
        id: "manual",
        icon: "search",
        title: "Búsqueda y registro manual",
        description:
          "Busca entre alimentos genéricos, platos peruanos y productos de marca, elige la porción casera o los gramos y listo. También puedes crear tus propios alimentos.",
        planFeature: "manual_logging",
      },
      {
        id: "codigo",
        icon: "barcode",
        title: "Código de barras",
        description:
          "Escanea el empaque con la cámara. Buscamos el producto en nuestra base y en Open Food Facts; si no aparece o le faltan datos, puedes agregarlo tú.",
        planFeature: "manual_logging",
      },
      {
        id: "foto",
        icon: "camera",
        title: "Foto de tu plato",
        description: "Toma una foto y la IA propone qué alimentos ve y cuánto. Revisas, corriges y recién ahí se guarda.",
        planFeature: "ai_photo",
      },
      {
        id: "voz",
        icon: "mic",
        title: "Por voz",
        description: "Di lo que comiste («un pan con palta y un café con leche») y revisa la propuesta antes de guardarla.",
        planFeature: "ai_voice",
      },
      {
        id: "texto",
        icon: "type",
        title: "Escribiendo como hablas",
        description: "Escribe tu comida en una frase. La IA la separa en alimentos y porciones para que la confirmes.",
        planFeature: "ai_text",
      },
    ],
  },
  {
    id: "planificar",
    title: "Planificar tu semana",
    intro: "Menos decisiones a última hora: un plan según tu meta, recetas que puedes cocinar y una lista para el mercado.",
    features: [
      {
        id: "plan",
        icon: "calendar",
        title: "Plan de comidas",
        description:
          "Arma un plan de hasta 14 días según tus calorías, tu forma de comer, tus alergias y tu presupuesto. Cambia cualquier comida y, si quieres, compártelo con un enlace.",
        planFeature: "meal_plans",
      },
      {
        id: "recetas",
        icon: "chef",
        title: "Recetas",
        description:
          "Recetas con sus calorías y macros por porción, calculadas desde sus ingredientes. Guarda tus favoritas y crea las tuyas.",
        alwaysFree: true,
      },
      {
        id: "compras",
        icon: "cart",
        title: "Lista de compras",
        description: "Sale de tu plan, agrupada por categoría, con precios referenciales de Lima (no son precios en tiempo real).",
        planFeature: "shopping_list",
      },
    ],
  },
  {
    id: "seguir",
    title: "Seguir tu progreso",
    intro: "Mira tu tendencia, no solo el número del día. Sin alarmas ni castigos si un día comes de más.",
    features: [
      {
        id: "progreso",
        icon: "trending",
        title: "Peso, medidas y fotos",
        description:
          "Registra tu peso y medidas y mira la tendencia semanal. Las fotos de progreso se guardan en un espacio privado que solo tú ves.",
        planFeature: "basic_tracking",
      },
      {
        id: "agua",
        icon: "droplet",
        title: "Agua",
        description: "Suma vasos en un toque y mira cuánto te falta para tu meta del día.",
        planFeature: "water",
      },
      {
        id: "ayuno",
        icon: "timer",
        title: "Ayuno",
        description:
          "Temporizador para protocolos como 12:12 o 16:8. No se ofrece a quienes, por su perfil, no deberían ayunar.",
        alwaysFree: true,
      },
      {
        id: "actividad",
        icon: "activity",
        title: "Actividad física",
        description: "Registra tus entrenamientos y caminatas. El gasto es una estimación y tú decides si se suma a tu día.",
        alwaysFree: true,
      },
      {
        id: "logros",
        icon: "trophy",
        title: "Logros y recordatorios",
        description: "Insignias por constancia y recordatorios de agua, comidas o pesaje que puedes activar o apagar.",
        alwaysFree: true,
      },
      {
        id: "asistente",
        icon: "sparkles",
        title: "Asistente nutricional",
        description:
          "Pregunta qué comer para llegar a tu proteína o cómo armar una cena ligera. Conoce tus metas y no da indicaciones médicas.",
        planFeature: "assistant",
      },
    ],
  },
];

export const ALL_FEATURES: MarketingFeature[] = FEATURE_GROUPS.flatMap((g) => g.features);

/** Las 12 funciones que resume la portada (en este orden). */
export const LANDING_FEATURE_IDS = [
  "manual",
  "foto",
  "voz",
  "texto",
  "codigo",
  "plan",
  "recetas",
  "compras",
  "progreso",
  "ayuno",
  "agua",
  "asistente",
] as const;

export type PlanBadge = "free" | "premium" | null;

/**
 * Etiqueta de plan de una función según los planes REALES de la BD. Sin datos de planes no se
 * muestra etiqueta (mejor nada que una etiqueta equivocada).
 */
export function planBadgeFor(
  feature: Pick<MarketingFeature, "planFeature" | "alwaysFree">,
  plans: { free: readonly string[]; premium: readonly string[] } | null,
): PlanBadge {
  if (feature.alwaysFree) return "free";
  if (!plans || !feature.planFeature) return null;
  if (plans.free.includes(feature.planFeature)) return "free";
  if (plans.premium.includes(feature.planFeature)) return "premium";
  return null;
}

/** Capturas reales de la app (las genera un paso con Playwright, viewport 390×844). */
export const SCREENSHOTS = {
  inicio: {
    file: "/screenshots/inicio.png",
    alt: "Pantalla de inicio de la app: anillo con las calorías que te quedan hoy, barras de proteína, carbohidratos y grasas, y tus comidas del día.",
  },
  diario: {
    file: "/screenshots/diario.png",
    alt: "Diario de comidas: desayuno, almuerzo, cena y snacks con los alimentos registrados y sus calorías.",
  },
  "foto-ia": {
    file: "/screenshots/foto-ia.png",
    alt: "Registro con foto: la propuesta de alimentos y porciones que hizo la IA, lista para revisar antes de guardar.",
  },
  plan: {
    file: "/screenshots/plan.png",
    alt: "Plan de comidas de la semana con las recetas de cada día y sus calorías.",
  },
  progreso: {
    file: "/screenshots/progreso.png",
    alt: "Pantalla de progreso: gráfico de la tendencia de tu peso y tus medidas.",
  },
} as const;

export type ScreenshotKey = keyof typeof SCREENSHOTS;

/** Tamaño de referencia de las capturas (CSS px del viewport móvil de Playwright). */
export const SCREENSHOT_SIZE = { width: 390, height: 844 } as const;
/** scripts/capture-screenshots.ts toma las capturas a esta densidad (archivo de 780×1688 px). */
export const SCREENSHOT_PIXEL_RATIO = 2;

export const LEGAL_DOCS = {
  terminos: {
    title: "Términos y condiciones",
    description: "Las reglas de uso del servicio: qué ofrece la app, tus responsabilidades y las nuestras.",
  },
  privacidad: {
    title: "Política de privacidad",
    description: "Qué datos personales tratamos, para qué, con quién se comparten y cómo ejercer tus derechos.",
  },
  "datos-de-salud": {
    title: "Tratamiento de datos de salud",
    description: "Cómo usamos y protegemos tus datos de salud, que la Ley N.° 29733 considera datos sensibles.",
  },
} as const;

export type LegalSlug = keyof typeof LEGAL_DOCS;

export function isLegalSlug(value: string): value is LegalSlug {
  return Object.hasOwn(LEGAL_DOCS, value);
}

/** Premium features que se mencionan en la portada (para el bloque de precios). */
export const PRICING_HIGHLIGHTS: PremiumFeature[] = ["ai_photo", "ai_voice", "ai_text", "meal_plans", "shopping_list", "assistant"];
