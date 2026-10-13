"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { CONSENT_INFO } from "@/features/auth/consents";
import { grantAiConsentAction } from "../actions";

/**
 * Sin consentimiento de IA vigente: explica qué se envía y a quién, y permite otorgarlo aquí
 * mismo (queda en el historial de Privacidad, donde se puede retirar).
 */
export function ConsentCard({ what, onGranted }: { what: string; onGranted?: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const grant = () =>
    startTransition(async () => {
      const res = await grantAiConsentAction();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Listo, autorizaste el análisis con IA.");
      onGranted?.();
      router.refresh();
    });

  return (
    <section aria-labelledby="ai-consent-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent text-primary-strong">
        <ShieldCheck className="size-6" aria-hidden="true" />
      </div>
      <h2 id="ai-consent-title" className="text-lg font-semibold tracking-tight">
        Necesitamos tu permiso para usar la IA
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{CONSENT_INFO.ai_processing.description}</p>
      <ul className="mt-3 grid gap-1.5 text-sm">
        <li>• Se envía {what} a un proveedor de IA externo (Anthropic) solo para identificar alimentos y cantidades.</li>
        <li>• La IA no calcula calorías: los valores salen de nuestra base de alimentos.</li>
        <li>• Puedes retirar este permiso cuando quieras en Privacidad.</li>
      </ul>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button onClick={grant} loading={pending}>
          Autorizar el análisis con IA
        </Button>
        <Button asChild variant="outline">
          <Link href="/app/perfil/privacidad">Ver Privacidad</Link>
        </Button>
      </div>
    </section>
  );
}
