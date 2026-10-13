import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Markdown } from "../markdown";
import type { FaqItem } from "../queries";

/**
 * Preguntas frecuentes con <details>/<summary>: acordeón accesible por teclado y lector de pantalla
 * sin JavaScript. Las respuestas son markdown seguro.
 */
export function FaqList({ items, className, headingLevel = 3 }: { items: FaqItem[]; className?: string; headingLevel?: 2 | 3 }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cn("divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      {items.map((item) => (
        <details key={item.slug} id={item.slug} className="group scroll-mt-24">
          <summary
            className={cn(
              "flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left",
              "outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            <Heading className="text-base font-semibold leading-snug">{item.question}</Heading>
            <ChevronDown
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5 text-muted-foreground">
            <Markdown source={item.answerMd} headingOffset={3} className="text-[0.95rem] text-foreground/85" />
          </div>
        </details>
      ))}
    </div>
  );
}
