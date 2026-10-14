import { SCREENSHOTS, type ScreenshotKey } from "./content";
import { AVAILABLE_SCREENSHOTS } from "./screenshots.available";

/**
 * ¿Existe ya la captura real? La lista la escribe el script que toma las capturas
 * (scripts/capture-screenshots.ts). No se mira el disco en tiempo de ejecución: en hostings con
 * CDN `public/` no está junto a la función, y leerlo hace que el build empaquete todo el proyecto.
 * Mientras falte una captura, la portada muestra un marco que lo dice en vez de una imagen rota.
 */
export function screenshotExists(key: ScreenshotKey, available: readonly ScreenshotKey[] = AVAILABLE_SCREENSHOTS): boolean {
  return available.includes(key);
}

export function availableScreenshots(available: readonly ScreenshotKey[] = AVAILABLE_SCREENSHOTS): Record<ScreenshotKey, boolean> {
  const keys = Object.keys(SCREENSHOTS) as ScreenshotKey[];
  return Object.fromEntries(keys.map((key) => [key, screenshotExists(key, available)])) as Record<ScreenshotKey, boolean>;
}
