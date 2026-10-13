import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { PremiumGate } from "@/components/app/premium-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AiNotConfiguredNotice, AiPlanWithoutQuotaNotice, AiQuotaNotice } from "@/features/ai/components/ai-notices";
import { ConsentCard } from "@/features/ai/components/consent-card";
import { getAiStatus } from "@/features/ai/server/availability";
import { AssistantChat } from "@/features/assistant/components/assistant-chat";
import { getConversationMessages, listConversations } from "@/features/assistant/queries";
import { getProfile, requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Asistente" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Asistente de nutrición general con streaming. Contexto mínimo autorizado (meta, objetivo y
 * totales de hoy), sin diagnósticos ni prescripciones. El historial propio siempre se puede leer
 * (también si la persona ya no tiene Premium); escribir requiere Premium, consentimiento de IA,
 * IA configurada y cupo.
 */
export default async function AssistantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("/app/asistente");
  const params = await searchParams;
  const requested = typeof params.c === "string" && UUID_RE.test(params.c) ? params.c : null;
  const [supabase, profile, entitlements] = await Promise.all([createSupabaseServerClient(), getProfile(), getEntitlements()]);
  const [status, conversations, selected] = await Promise.all([
    getAiStatus(supabase, user.id, profile?.timezone, entitlements),
    listConversations(supabase, user.id),
    requested ? getConversationMessages(supabase, user.id, requested) : Promise.resolve(null),
  ]);
  const chat = status.kinds.chat;
  const hasFeature = entitlements.features.has("assistant");
  const canSend = hasFeature && status.configured && status.consent && chat.limit > 0 && chat.used < chat.limit;

  let notice: React.ReactNode = null;
  if (!hasFeature) notice = <PremiumGate feature="assistant">{null}</PremiumGate>;
  else if (!status.configured) notice = <AiNotConfiguredNotice alternativeHref="/app" alternativeLabel="Volver al inicio" />;
  else if (!status.consent) notice = <ConsentCard what="tus mensajes al asistente" />;
  else if (chat.limit === 0) notice = <AiPlanWithoutQuotaNotice />;
  else if (chat.used >= chat.limit) notice = <AiQuotaNotice used={chat.used} limit={chat.limit} periodStart={status.periodStart} />;

  return (
    <>
      <AppHeader title="Asistente" subtitle={selected ? selected.conversation.title : "Nutrición general, sin juicios"} />
      <div className="grid gap-4 pb-8 pt-2">
        {!hasFeature && conversations.length === 0 ? (
          // Sin Premium y sin historial: solo la invitación (no hay nada que leer).
          <PremiumGate feature="assistant">{null}</PremiumGate>
        ) : (
          <>
            <Alert variant="info">
              <Info aria-hidden="true" />
              <AlertTitle>No es consejo médico</AlertTitle>
              <AlertDescription>
                <p>
                  Orientación general basada en tu meta y lo que registraste hoy. No diagnostica ni reemplaza a un profesional de salud. Si
                  es una emergencia, llama al 106 (SAMU); para hablar de salud mental, a la Línea 113, opción 5.
                </p>
              </AlertDescription>
            </Alert>
            {requested && !selected ? (
              <Alert variant="warning">
                <AlertTitle>No encontramos esa conversación</AlertTitle>
                <AlertDescription>
                  <p>Puede que la hayas borrado. Empieza una nueva abajo.</p>
                </AlertDescription>
              </Alert>
            ) : null}
            {notice}
            <AssistantChat
              key={selected?.conversation.id ?? "nueva"}
              conversationId={selected?.conversation.id ?? null}
              initialMessages={selected?.messages ?? []}
              conversations={conversations}
              quota={{ used: chat.used, limit: chat.limit }}
              canSend={canSend}
            />
          </>
        )}
      </div>
    </>
  );
}
