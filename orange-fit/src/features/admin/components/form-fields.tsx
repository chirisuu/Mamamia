"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { numberOrNull } from "../schemas";

type NumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | null | undefined;
  onValueChange: (value: number | null) => void;
  decimals?: boolean;
};

/**
 * Input numérico para formularios RHF: guarda el texto mientras se escribe ("12." o "0,5") y
 * entrega el número (o null si está vacío; NaN si no es número, para que Zod muestre el error).
 */
export function NumberInput({ value, onValueChange, decimals = true, ...props }: NumberInputProps) {
  const show = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? "" : String(v));
  const [text, setText] = React.useState(() => show(value));
  const [seen, setSeen] = React.useState(value);
  // Si el valor cambia desde fuera (reset del formulario), se refleja en el texto.
  if (!Object.is(seen, value)) {
    setSeen(value);
    const parsed = numberOrNull(text);
    if (!Object.is(parsed, value ?? null)) setText(show(value));
  }
  return (
    <Input
      {...props}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      autoComplete="off"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValueChange(numberOrNull(e.target.value));
      }}
    />
  );
}
