"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SegmentedOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: "sm" | "default";
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/**
 * Selector de una opción entre 2–4 (p. ej. "Día / Semana / Mes"). Siempre hay una opción
 * activa (no se puede deseleccionar). Teclado: flechas para moverse, Espacio/Enter para elegir.
 */
function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  size = "default",
  disabled,
  className,
  ...aria
}: SegmentedControlProps<T>) {
  const indicatorId = React.useId();
  const reduceMotion = useReducedMotion();

  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => {
        // Radix permite deseleccionar en modo single; aquí siempre debe haber una opción.
        if (next) onValueChange(next as T);
      }}
      disabled={disabled}
      data-slot="segmented-control"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-2xl bg-muted p-1",
        size === "sm" ? "h-12" : "h-13",
        className,
      )}
      {...aria}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <ToggleGroupPrimitive.Item
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            data-slot="segmented-control-item"
            className={cn(
              "relative inline-flex h-full min-w-0 flex-1 items-center justify-center rounded-xl px-3 text-sm font-medium",
              "text-muted-foreground transition-colors duration-150 hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:pointer-events-none disabled:opacity-50 data-[state=on]:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={indicatorId}
                aria-hidden="true"
                className="absolute inset-0 rounded-xl bg-card shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.12, duration: 0.25 }}
              />
            ) : null}
            <span className="relative z-10 inline-flex min-w-0 items-center gap-2 truncate">
              {Icon ? <Icon className="size-4 shrink-0" aria-hidden="true" /> : null}
              {option.label}
            </span>
          </ToggleGroupPrimitive.Item>
        );
      })}
    </ToggleGroupPrimitive.Root>
  );
}

export { SegmentedControl, type SegmentedOption, type SegmentedControlProps };
