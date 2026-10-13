import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { AiStateGate } from "@/features/ai/components/ai-state-gate";
import { PhotoFlow } from "@/features/ai/components/photo-flow";
import { getAiLogPageData } from "@/features/ai/server/page-data";

export const metadata: Metadata = { title: "Registrar con foto" };

/** Registro por foto con IA: la IA sugiere alimentos y gramos; tú eliges de la base y confirmas. */
export default async function PhotoLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await getAiLogPageData("/app/agregar/foto", await searchParams);
  const photo = data.status.kinds.photo;
  return (
    <>
      <AppHeader title="Registrar con foto" subtitle={data.subtitle} backHref={data.backHref} />
      <div className="grid gap-4 pb-8 pt-2">
        <PremiumGate feature="ai_photo">
          <AiStateGate
            status={data.status}
            kind="photo"
            what="tus fotos de comida"
            alternativeHref={data.searchHref}
            alternativeLabel="Buscar el alimento por nombre"
          >
            <PhotoFlow
              localDate={data.target.localDate}
              maxDate={data.tomorrow}
              defaultMeal={data.target.mealType}
              defaultCustomName={data.target.customName}
              mealOptions={data.mealOptions}
              quota={{ used: photo.used, limit: photo.limit }}
              searchHref={data.searchHref}
            />
          </AiStateGate>
        </PremiumGate>
      </div>
    </>
  );
}
