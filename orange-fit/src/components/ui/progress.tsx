"use client";

import * as React from "react";
import { Progress as ProgressPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indicatorClassName?: string;
};

/** Barra de progreso lineal. `value` entre 0 y `max` (100 por defecto); se recorta al rango. */
function Progress({ className, indicatorClassName, value, max = 100, ...props }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = value == null ? null : Math.min(Math.max(value, 0), safeMax);
  const pct = clamped == null ? 0 : (clamped / safeMax) * 100;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      max={safeMax}
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn("h-full w-full rounded-full bg-primary transition-transform duration-200 ease-out", indicatorClassName)}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
