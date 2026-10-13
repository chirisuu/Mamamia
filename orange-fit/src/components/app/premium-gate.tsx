import Link from "next/link";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEntitlements } from "@/lib/billing/entitlements";
import { FEATURE_LABELS, type PremiumFeature } from "@/lib/billing/features";

/**
 * Muestra el contenido si el plan del usuario incluye la función; si no, una invitación
 * clara a Premium (sin botones falsos: lleva a /app/premium, donde se ve el estado real de pagos).
 */
export async function PremiumGate({ feature, children }: { feature: PremiumFeature; children: React.ReactNode }) {
  const ent = await getEntitlements();
  if (ent.features.has(feature)) return <>{children}</>;
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
        <Crown className="size-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{FEATURE_LABELS[feature]} es parte de Premium</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Tu plan gratis incluye registro manual, calorías, macros, agua y seguimiento básico.
      </p>
      <Button asChild className="mt-4">
        <Link href="/app/premium">Ver Premium</Link>
      </Button>
    </div>
  );
}
