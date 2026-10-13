"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addDays } from "@/lib/dates";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { dayLabel } from "../lib/meal-time";

/** Navegación del diario: día anterior/siguiente y selector de fecha (hasta mañana). */
export function DayNav({ date, today, maxDate }: { date: string; today: string; maxDate: string }) {
  const router = useRouter();
  const inputId = React.useId();
  const prev = addDays(date, -1);
  const next = addDays(date, 1);
  const canNext = next <= maxDate;
  const [pending, startTransition] = React.useTransition();

  return (
    <nav aria-label="Cambiar de día" className="flex items-center gap-2" aria-busy={pending || undefined}>
      <Button asChild variant="outline" size="icon-sm" className="rounded-full">
        <Link href={`/app/diario/${prev}`} aria-label={`Día anterior, ${formatShortDate(prev)}`}>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>

      <label
        htmlFor={inputId}
        className={cn(
          "relative flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full border border-input bg-card px-4 text-sm font-semibold",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        <CalendarDays className="size-4 text-primary-strong" aria-hidden="true" />
        <span className="truncate">{dayLabel(date, today)}</span>
        {date !== today ? <span className="sr-only">, {formatShortDate(date)}</span> : null}
        <input
          id={inputId}
          type="date"
          value={date}
          min="2000-01-01"
          max={maxDate}
          aria-label="Elegir fecha"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onClick={(e) => {
            // En escritorio el calendario nativo solo se abre desde su icono: lo abrimos al tocar.
            try {
              e.currentTarget.showPicker?.();
            } catch {
              // Navegadores sin showPicker: queda el teclado.
            }
          }}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= maxDate && v !== date) {
              startTransition(() => router.push(`/app/diario/${v}`));
            }
          }}
        />
      </label>

      {canNext ? (
        <Button asChild variant="outline" size="icon-sm" className="rounded-full">
          <Link href={`/app/diario/${next}`} aria-label={`Día siguiente, ${formatShortDate(next)}`}>
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="icon-sm" className="rounded-full" disabled aria-label="No puedes ir más allá de mañana">
          <ChevronRight aria-hidden="true" />
        </Button>
      )}
      {date !== today ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/app/diario/${today}`}>Hoy</Link>
        </Button>
      ) : null}
    </nav>
  );
}
