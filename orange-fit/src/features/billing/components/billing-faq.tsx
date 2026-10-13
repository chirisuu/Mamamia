import { ChevronDown } from "lucide-react";

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Desde Perfil → Suscripción cancelas la renovación en un paso. Conservas Premium hasta el final del periodo que ya pagaste y no se hacen más cobros. Tus registros se quedan contigo en el plan gratis.",
  },
  {
    q: "¿Guardan los datos de mi tarjeta?",
    a: "No. El pago se hace en la página segura de Stripe o de Mercado Pago. Nosotros solo guardamos el estado de tu suscripción y el historial de cobros (fecha, monto y estado), nunca el número de tu tarjeta.",
  },
  {
    q: "¿En qué moneda me cobran?",
    a: "Con Mercado Pago, en soles (S/). Con tarjeta internacional vía Stripe, en dólares (US$); tu banco puede aplicar su tipo de cambio o comisiones por compras en el extranjero.",
  },
  {
    q: "¿Cómo funciona la prueba gratis?",
    a: "Es para tu primera suscripción. Te pedimos el medio de pago al empezar, pero el primer cobro se hace cuando termina la prueba. Si cancelas antes, no se te cobra nada.",
  },
  {
    q: "¿Premium me garantiza resultados?",
    a: "No. Premium te da herramientas para registrar y planificar con menos esfuerzo; los resultados dependen de muchos factores. Las metas son estimaciones y no reemplazan a un profesional de la salud.",
  },
];

/** Preguntas frecuentes de pagos (acordeón nativo: funciona sin JavaScript y con teclado). */
export function BillingFaq({ headingId = "faq-pagos" }: { headingId?: string }) {
  return (
    <section aria-labelledby={headingId} className="grid gap-3">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        Preguntas sobre pagos
      </h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {QUESTIONS.map((item) => (
          <details key={item.q} className="group">
            <summary
              className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden"
            >
              {item.q}
              <ChevronDown className="size-5 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
