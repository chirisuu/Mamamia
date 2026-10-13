"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Interruptor. Visualmente 28 px de alto; el pseudo-elemento amplía el área táctil a 44 px.
 * Encendido: pista naranja + perilla carbón (6.2:1), así el estado no depende solo del color.
 */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-transparent",
        "after:absolute after:-inset-2 after:content-['']",
        "transition-colors duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-6 rounded-full shadow-sm ring-0 transition-[translate,background-color] duration-150",
          "data-[state=checked]:translate-x-5 data-[state=checked]:bg-primary-foreground",
          "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-card",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
