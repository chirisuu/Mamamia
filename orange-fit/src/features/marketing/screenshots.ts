import "server-only";
import fs from "node:fs";
import path from "node:path";
import { SCREENSHOTS, type ScreenshotKey } from "./content";

/**
 * ¿Existe ya la captura real? Las genera un paso aparte (Playwright); mientras falten, la portada
 * muestra un marco que lo dice en vez de una imagen rota o un mockup inventado.
 *
 * Si la carpeta `public/` no está en el disco del servidor (algunos hostings sirven los estáticos
 * desde una CDN y no los copian a la función), no podemos saberlo: se asume que existe.
 */
export function screenshotExists(key: ScreenshotKey, publicDir = path.join(process.cwd(), "public")): boolean {
  try {
    if (!fs.existsSync(publicDir)) return true;
    return fs.existsSync(path.join(publicDir, SCREENSHOTS[key].file.replace(/^\//, "")));
  } catch {
    return true;
  }
}

export function availableScreenshots(): Record<ScreenshotKey, boolean> {
  const keys = Object.keys(SCREENSHOTS) as ScreenshotKey[];
  return Object.fromEntries(keys.map((key) => [key, screenshotExists(key)])) as Record<ScreenshotKey, boolean>;
}
