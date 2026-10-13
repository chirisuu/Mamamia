import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { AiStateGate } from "@/features/ai/components/ai-state-gate";
import { TextFlow } from "@/features/ai/components/text-entry";
import { getAiLogPageData } from "@/features/ai/server/page-data";

export const metadata: Metadata = { title: "Registrar escribiendo" };

/** Registro por texto libre: la IA estructura alimentos y cantidades; los gramos salen de las porciones de la base. */
export default async function TextLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await getAiLogPageData("/app/agregar/texto", await searchParams);
  const text = data.status.kinds.text;
  return (
    <>
      <AppHeader title="Escribe lo que comiste" subtitle={data.subtitle} backHref={data.backHref} />
      <div className="grid gap-4 pb-8 pt-2">
        <PremiumGate feature="ai_text">
          <AiStateGate
            status={data.status}
            kind="text"
            what="lo que escribes sobre tus comidas"
            alternativeHref={data.searchHref}
            alternativeLabel="Buscar el alimento por nombre"
          >
            <TextFlow
              localDate={data.target.localDate}
              maxDate={data.tomorrow}
              defaultMeal={data.target.mealType}
              defaultCustomName={data.target.customName}
              mealOptions={data.mealOptions}
              quota={{ used: text.used, limit: text.limit }}
              searchHref={data.searchHref}
            />
          </AiStateGate>
        </PremiumGate>
      </div>
    </>
  );
}
