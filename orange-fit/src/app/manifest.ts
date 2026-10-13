import type { MetadataRoute } from "next";
import { getAppSettings } from "@/lib/config/app-settings";
import { buildManifest } from "@/features/marketing/pwa";
import { availableScreenshots } from "@/features/marketing/screenshots";

/** /manifest.webmanifest con el nombre vigente de la app (app_settings) y las capturas que existan. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { appName } = await getAppSettings();
  return buildManifest(appName, availableScreenshots());
}
