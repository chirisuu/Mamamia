"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseBarcode } from "@/lib/foods/barcode";

export type ManualCodeFormProps = {
  onSubmit: (code: string) => void;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  defaultValue?: string;
};

/** Alternativa al escáner: escribir los números del código (se valida el dígito verificador). */
export function ManualCodeForm({ onSubmit, disabled, inputRef, defaultValue = "" }: ManualCodeFormProps) {
  const id = React.useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const [value, setValue] = React.useState(defaultValue);
  const [error, setError] = React.useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = parseBarcode(value);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setError(null);
    onSubmit(parsed.code);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2" aria-label="Buscar por número de código">
      <Label htmlFor={id}>Número del código de barras</Label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          name="codigo"
          inputMode="numeric"
          autoComplete="off"
          enterKeyHint="search"
          maxLength={18}
          placeholder="7750000000000"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          className="tabular-nums"
          disabled={disabled}
        />
        <Button type="submit" variant="secondary" disabled={disabled} className="shrink-0">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        Son los 8, 12 o 13 números que aparecen debajo de las barras.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
