import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCents } from "@/lib/format";
import { formatBillingDate, PAYMENT_STATUS_LABELS, PROVIDER_LABELS } from "../labels";
import type { PaymentListItem } from "../queries";

const STATUS_VARIANT = {
  succeeded: "success",
  pending: "secondary",
  failed: "warning",
  refunded: "outline",
} as const;

/** Historial de cobros (tabla `payments`): fecha, monto, estado. Nunca datos de tarjeta. */
export function PaymentHistory({ payments, timeZone }: { payments: PaymentListItem[]; timeZone: string }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="Aún no hay cobros"
        description="Cuando se haga un cobro de tu suscripción lo verás aquí. Durante la prueba gratis no se cobra nada."
      />
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {payments.map((p) => (
        <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium tabular-nums">{formatCents(p.amountCents, p.currencyCode)}</p>
            <p className="truncate text-sm text-muted-foreground">
              {formatBillingDate(p.paidAt ?? p.createdAt, timeZone)} · {PROVIDER_LABELS[p.provider].secure}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{PAYMENT_STATUS_LABELS[p.status] ?? p.status}</Badge>
        </li>
      ))}
    </ul>
  );
}
