"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AmountOption } from "../lib/portion-options";

type AmountFieldsProps = {
  options: readonly AmountOption[];
  optionKey: string;
  amount: number;
  onChange: (next: { optionKey: string; amount: number }) => void;
  disabled?: boolean;
};

/** Cantidad + medida (gramos, porción casera o ml). Al cambiar de medida, vuelve a su cantidad típica. */
export function AmountFields({ options, optionKey, amount, onChange, disabled }: AmountFieldsProps) {
  const id = React.useId();
  const option = options.find((o) => o.key === optionKey) ?? options[0]!;
  return (
    <div className="grid gap-3">
      {options.length > 1 ? (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-unit`}>Medida</Label>
          <Select
            value={option.key}
            onValueChange={(key) => {
              const next = options.find((o) => o.key === key);
              if (next) onChange({ optionKey: key, amount: next.defaultAmount });
            }}
            disabled={disabled}
          >
            <SelectTrigger id={`${id}-unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.key} value={o.key}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-amount`}>Cantidad</Label>
        <NumberStepper
          id={`${id}-amount`}
          value={amount}
          onValueChange={(v) => onChange({ optionKey: option.key, amount: v })}
          min={option.min}
          max={option.max}
          step={option.step}
          decimals={option.decimals}
          unit={option.unitLabel.length <= 6 ? option.unitLabel : undefined}
          label="Cantidad"
          disabled={disabled}
        />
        {option.unitLabel.length > 6 ? <p className="text-sm text-muted-foreground">{option.unitLabel}</p> : null}
      </div>
    </div>
  );
}
