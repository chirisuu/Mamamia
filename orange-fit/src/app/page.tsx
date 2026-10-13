import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getAppSettings } from "@/lib/config/app-settings";

/**
 * Marcador temporal de la página de inicio: solo encabezado y pie del sitio.
 * La landing definitiva la construye otro módulo (src/app/(marketing)).
 */
export default async function HomePage() {
  const { appName, supportEmail } = await getAppSettings();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader appName={appName} />
      <main id="contenido" className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-3 px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{appName}</h1>
        <p className="max-w-xl text-muted-foreground">Estamos preparando esta página.</p>
      </main>
      <SiteFooter appName={appName} supportEmail={supportEmail} />
    </div>
  );
}
