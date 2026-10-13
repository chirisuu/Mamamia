import type { MetadataRoute } from "next";
import { SCREENSHOTS, SCREENSHOT_SIZE, type ScreenshotKey } from "./content";

/**
 * Manifiesto de la PWA. Puro (sin I/O) para poder probarlo: `src/app/manifest.ts` le pasa el nombre
 * vigente de la app y qué capturas existen.
 */

/** Colores del manifiesto = paleta de marca (docs/DESIGN_SYSTEM.md §1). El manifiesto exige valores literales. */
export const MANIFEST_COLORS = { carbon: "#17181C" } as const;

/** Iconos generados por scripts/generate-icons.mjs desde public/icons/logo.svg. */
export const PWA_ICONS = [
  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
] as const satisfies NonNullable<MetadataRoute.Manifest["icons"]>;

/** "short_name" corto (lo que se ve bajo el icono): el nombre si cabe, si no su primera palabra. */
export function shortAppName(appName: string): string {
  const name = appName.trim();
  if (name.length <= 12) return name;
  return (name.split(/\s+/)[0] ?? name).slice(0, 12);
}

export function buildManifest(appName: string, screenshots: Partial<Record<ScreenshotKey, boolean>> = {}): MetadataRoute.Manifest {
  const shots = (Object.keys(SCREENSHOTS) as ScreenshotKey[])
    .filter((key) => screenshots[key])
    .map((key) => ({
      src: SCREENSHOTS[key].file,
      // Las capturas son de 390×844 CSS px; el archivo real puede tener más densidad, pero la
      // proporción es la misma y los navegadores la usan solo para la vista previa.
      sizes: `${SCREENSHOT_SIZE.width}x${SCREENSHOT_SIZE.height}`,
      type: "image/png",
      form_factor: "narrow" as const,
      label: SCREENSHOTS[key].alt,
    }));

  return {
    id: "/app",
    name: appName,
    short_name: shortAppName(appName),
    description: "Registra tus comidas, conoce tus calorías y macros y sigue tu progreso a tu ritmo.",
    lang: "es-PE",
    dir: "ltr",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: MANIFEST_COLORS.carbon,
    theme_color: MANIFEST_COLORS.carbon,
    categories: ["health", "fitness", "food", "lifestyle"],
    icons: [...PWA_ICONS],
    shortcuts: [
      {
        name: "Registrar comida",
        short_name: "Registrar",
        description: "Busca un alimento y agrégalo a tu diario",
        url: "/app/agregar/buscar",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Agua",
        short_name: "Agua",
        description: "Suma un vaso de agua a tu día",
        url: "/app/agua",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    ...(shots.length > 0 ? { screenshots: shots } : {}),
  };
}
