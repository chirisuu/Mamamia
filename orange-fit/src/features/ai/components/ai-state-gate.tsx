import type { AiKind, AiStatusResponse } from "../schemas";
import { AiNotConfiguredNotice, AiPlanWithoutQuotaNotice, AiQuotaNotice } from "./ai-notices";
import { ConsentCard } from "./consent-card";

/**
 * Antes de mostrar un flujo de IA, dice con honestidad por qué no se puede usar (si es el caso):
 * IA pendiente de configurar, sin consentimiento, plan sin cupo o cupo agotado.
 * (El plan sin la función lo resuelve `<PremiumGate>` por fuera.)
 */
export function AiStateGate({
  status,
  kind,
  what,
  alternativeHref,
  alternativeLabel,
  children,
}: {
  status: AiStatusResponse;
  kind: AiKind;
  what: string;
  alternativeHref: string;
  alternativeLabel: string;
  children: React.ReactNode;
}) {
  const k = status.kinds[kind];
  if (!status.configured) return <AiNotConfiguredNotice alternativeHref={alternativeHref} alternativeLabel={alternativeLabel} />;
  if (!status.consent) return <ConsentCard what={what} />;
  if (k.limit === 0) return <AiPlanWithoutQuotaNotice />;
  if (k.used >= k.limit) {
    return (
      <AiQuotaNotice
        used={k.used}
        limit={k.limit}
        periodStart={status.periodStart}
        alternativeHref={alternativeHref}
        alternativeLabel={alternativeLabel}
      />
    );
  }
  return <>{children}</>;
}
