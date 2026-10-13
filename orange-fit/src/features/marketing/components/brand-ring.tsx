import { cn } from "@/lib/utils";

/**
 * Motivo decorativo de la marca (el anillo de progreso del logo, en grande). Es solo forma y color:
 * no representa datos. Oculto para lectores de pantalla.
 */
export function BrandRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false" className={cn("pointer-events-none", className)}>
      <path d="M38.42 14.99 A17 17 0 1 1 18.75 7.83" className="stroke-brand-orange" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="29.81" cy="8.03" r="1.6" className="fill-brand-amber" />
    </svg>
  );
}
