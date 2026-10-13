"use client";

import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChoiceOption<T extends string> = {
  value: T;
  label: React.ReactNode;
  description?: React.ReactNode;
  /** Texto pequeño a la derecha (p. ej. "0.4 kg/sem"). */
  aside?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
};

type ChoiceCardsProps<T extends string> = {
  options: readonly ChoiceOption<T>[];
  value: T | undefined;
  onValueChange: (value: T) => void;
  "aria-labelledby"?: string;
  "aria-label"?: string;
  className?: string;
};

/**
 * Opciones grandes de una sola elección (radiogroup accesible: flechas para moverse).
 * Seleccionada: borde naranja + fondo acento + check (no depende solo del color).
 */
export function ChoiceCards<T extends string>({ options, value, onValueChange, className, ...aria }: ChoiceCardsProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value ?? ""}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn("grid gap-3", className)}
      {...aria}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <RadioGroupPrimitive.Item
            key={o.value}
            value={o.value}
            disabled={o.disabled}
            className={cn(
              "group relative flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3 text-left",
              "transition-[border-color,background-color] duration-150 outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "disabled:cursor-not-allowed disabled:opacity-55",
              selected ? "border-primary bg-accent" : "border-border hover:border-input",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-base font-semibold leading-snug">
                {o.label}
                {o.badge}
              </span>
              {o.description ? (
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{o.description}</span>
              ) : null}
            </span>
            {o.aside ? <span className="shrink-0 text-right text-sm font-medium text-muted-foreground">{o.aside}</span> : null}
            <span
              aria-hidden="true"
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
              )}
            >
              {selected ? <Check className="size-4 stroke-[3]" /> : null}
            </span>
          </RadioGroupPrimitive.Item>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
