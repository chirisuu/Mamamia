"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipToggleProps = Omit<React.ComponentProps<"button">, "onChange"> & {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
};

/** Botón de selección múltiple (aria-pressed), 44 px de alto. */
export function ChipToggle({ pressed, onPressedChange, className, children, ...props }: ChipToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 px-4 text-sm font-medium",
        "transition-[border-color,background-color] duration-150 outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        pressed ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:border-input",
        className,
      )}
      {...props}
    >
      {pressed ? <Check className="size-4 stroke-[3]" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type ChipGroupProps = {
  options: ReadonlyArray<{ value: string; label: string }>;
  value: readonly string[];
  onChange: (value: string[]) => void;
  "aria-labelledby"?: string;
  "aria-label"?: string;
};

export function ChipGroup({ options, value, onChange, ...aria }: ChipGroupProps) {
  return (
    <div role="group" className="flex flex-wrap gap-2" {...aria}>
      {options.map((o) => {
        const pressed = value.includes(o.value);
        return (
          <ChipToggle
            key={o.value}
            pressed={pressed}
            onPressedChange={(p) => onChange(p ? [...value, o.value] : value.filter((v) => v !== o.value))}
          >
            {o.label}
          </ChipToggle>
        );
      })}
    </div>
  );
}
