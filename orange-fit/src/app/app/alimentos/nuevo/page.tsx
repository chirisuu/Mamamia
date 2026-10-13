import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { OwnFoodForm } from "@/features/diary/components/own-food-form";
import { safeReturnTo } from "@/features/diary/lib/return-to";
import { getDiaryPageContext } from "@/features/diary/server/page-context";

export const metadata: Metadata = { title: "Crear alimento" };

/**
 * Crear alimento propio. Acepta `?nombre=` y `?codigo=` para precargar (desde el buscador o el
 * escáner cuando no se encuentra el producto) y `?volver=` para regresar al registro.
 */
export default async function NewFoodPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await getDiaryPageContext("/app/alimentos/nuevo");
  const params = await searchParams;
  const nombre = typeof params.nombre === "string" ? params.nombre.trim().slice(0, 200) : "";
  const codigo = typeof params.codigo === "string" && /^[0-9]{6,14}$/.test(params.codigo) ? params.codigo : "";
  const returnTo = safeReturnTo(params.volver);
  return (
    <>
      <AppHeader title="Crear alimento" subtitle="Solo tú lo verás" backHref={returnTo ?? "/app/alimentos"} />
      <div className="pt-2 pb-8">
        <OwnFoodForm defaults={{ name: nombre, barcode: codigo }} returnTo={returnTo} />
      </div>
    </>
  );
}
