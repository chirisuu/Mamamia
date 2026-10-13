"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type NumberStepperProps = Omit<
  React.ComponentProps<"input">,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max" | "step" | "size" | "inputMode"
> & {
  value: number | null;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Decimales permitidos al escribir. Por defecto, los del `step` (step 0.5 → 1 decimal). */
  decimals?: number;
  /** Unidad visible junto al número ("g", "ml", "porciones"). */
  unit?: string;
  /** Nombre accesible del campo ("Cantidad"). Usa esto o un <Label htmlFor={id}>. */
  label?: string;
  decrementLabel?: string;
  incrementLabel?: string;
  size?: "default" | "lg";
};

function decimalsOf(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundTo(value: number, decimals: number): number {
  return Number(value.toFixed(decimals));
}

/** Convierte lo escrito ("12,5", " 30 ") en número; null si no es un número válido. */
function parseDraft(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "" || normalized === "." || normalized === "-") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Campo numérico con botones grandes −/+ (56 px) y teclado numérico en móvil.
 * Se comporta como spinbutton: flechas ↑/↓ suman/restan `step`, RePág/AvPág ×10, Inicio/Fin a los límites.
 * Lo escrito se valida al salir del campo o con Enter (acepta coma o punto decimal) y se ajusta al rango.
 */
function NumberStepper({
  value,
  onValueChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decimals,
  unit,
  label,
  decrementLabel,
  incrementLabel,
  size = "default",
  disabled,
  className,
  id,
  onBlur,
  onKeyDown,
  ...inputProps
}: NumberStepperProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const places = decimals ?? decimalsOf(step);
  // null = no se está editando; se muestra el valor controlado.
  const [draft, setDraft] = React.useState<string | null>(null);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const display = draft ?? (value == null ? "" : String(roundTo(value, places)));

  const commit = (next: number) => {
    const rounded = roundTo(clamp(next), places);
    if (rounded !== value) onValueChange(rounded);
  };

  const commitDraft = () => {
    if (draft == null) return;
    const parsed = parseDraft(draft);
    setDraft(null);
    if (parsed != null) commit(parsed);
  };

  const stepBy = (delta: number) => {
    const base = draft != null ? (parseDraft(draft) ?? value) : value;
    const start = base ?? (Number.isFinite(min) ? min : 0);
    setDraft(null);
    commit(start + delta);
  };

  const atMin = value != null && value <= min;
  const atMax = value != null && value >= max;
  const allowNegative = min < 0;
  const pattern = places > 0 ? (allowNegative ? /^-?\d*[.,]?\d*$/ : /^\d*[.,]?\d*$/) : allowNegative ? /^-?\d*$/ : /^\d*$/;

  const big = size === "lg";
  const buttonClass = cn(
    "inline-flex shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground",
    "transition-[background-color,scale] duration-150 active:scale-95 hover:bg-secondary/70",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-40",
    big ? "size-16" : "size-14",
  );

  return (
    <div data-slot="number-stepper" className={cn("flex w-full items-center gap-3", className)}>
      <button
        type="button"
        className={buttonClass}
        onClick={() => stepBy(-step)}
        disabled={disabled || atMin}
        aria-label={decrementLabel ?? (label ? `Disminuir ${label}` : "Disminuir")}
        aria-controls={inputId}
      >
        <Minus className="size-6" aria-hidden="true" />
      </button>

      <div
        className={cn(
          "relative flex min-w-0 flex-1 items-center justify-center rounded-2xl border border-input bg-card shadow-xs",
          "focus-within:border-ring focus-within:ring-1 focus-within:ring-ring",
          disabled && "opacity-50",
          big ? "h-16" : "h-14",
        )}
      >
        <input
          {...inputProps}
          id={inputId}
          type="text"
          role="spinbutton"
          inputMode={places > 0 ? "decimal" : "numeric"}
          enterKeyHint="done"
          autoComplete="off"
          aria-label={inputProps["aria-label"] ?? label}
          aria-valuenow={value ?? undefined}
          aria-valuemin={Number.isFinite(min) ? min : undefined}
          aria-valuemax={Number.isFinite(max) ? max : undefined}
          aria-valuetext={value == null ? undefined : `${roundTo(value, places)}${unit ? ` ${unit}` : ""}`}
          disabled={disabled}
          value={display}
          data-numeric=""
          className={cn(
            "w-full min-w-0 bg-transparent text-center font-semibold tracking-tight text-foreground outline-none",
            "placeholder:text-muted-foreground",
            big ? "text-3xl" : "text-2xl",
            unit && "pr-12",
          )}
          onChange={(event) => {
            const next = event.target.value;
            if (pattern.test(next)) setDraft(next);
          }}
          onBlur={(event) => {
            commitDraft();
            onBlur?.(event);
          }}
          onKeyDown={(event) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            switch (event.key) {
              case "Enter":
                commitDraft();
                break;
              case "ArrowUp":
                event.preventDefault();
                stepBy(step);
                break;
              case "ArrowDown":
                event.preventDefault();
                stepBy(-step);
                break;
              case "PageUp":
                event.preventDefault();
                stepBy(step * 10);
                break;
              case "PageDown":
                event.preventDefault();
                stepBy(-step * 10);
                break;
              case "Home":
                if (Number.isFinite(min)) {
                  event.preventDefault();
                  setDraft(null);
                  commit(min);
                }
                break;
              case "End":
                if (Number.isFinite(max)) {
                  event.preventDefault();
                  setDraft(null);
                  commit(max);
                }
                break;
            }
          }}
        />
        {unit ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 text-sm font-medium text-muted-foreground"
          >
            {unit}
          </span>
        ) : null}
      </div>

      <button
        type="button"
        className={buttonClass}
        onClick={() => stepBy(step)}
        disabled={disabled || atMax}
        aria-label={incrementLabel ?? (label ? `Aumentar ${label}` : "Aumentar")}
        aria-controls={inputId}
      >
        <Plus className="size-6" aria-hidden="true" />
      </button>
    </div>
  );
}

export { NumberStepper, parseDraft, type NumberStepperProps };
