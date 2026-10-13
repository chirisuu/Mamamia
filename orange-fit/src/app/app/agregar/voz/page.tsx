import type { Metadata } from "next";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { AiStateGate } from "@/features/ai/components/ai-state-gate";
import { VoiceFlow } from "@/features/ai/components/voice-flow";
import { getAiLogPageData } from "@/features/ai/server/page-data";

export const metadata: Metadata = { title: "Registrar por voz" };

/** Registro por voz: dictado del navegador o grabación + transcripción (si está configurada) y luego el flujo de texto. */
export default async function VoiceLogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const data = await getAiLogPageData("/app/agregar/voz", await searchParams);
  const voice = data.status.kinds.voice;
  return (
    <>
      <AppHeader title="Dicta lo que comiste" subtitle={data.subtitle} backHref={data.backHref} />
      <div className="grid gap-4 pb-8 pt-2">
        <PremiumGate feature="ai_voice">
          <AiStateGate
            status={data.status}
            kind="voice"
            what="el texto (o el audio) de tus dictados"
            alternativeHref={`/app/agregar/texto?${data.query}`}
            alternativeLabel="Escribir lo que comí"
          >
            <VoiceFlow
              localDate={data.target.localDate}
              maxDate={data.tomorrow}
              defaultMeal={data.target.mealType}
              defaultCustomName={data.target.customName}
              mealOptions={data.mealOptions}
              quota={{ used: voice.used, limit: voice.limit }}
              searchHref={data.searchHref}
              transcriptionConfigured={data.status.transcriptionConfigured}
              textHref={`/app/agregar/texto?${data.query}`}
            />
          </AiStateGate>
        </PremiumGate>
      </div>
    </>
  );
}
