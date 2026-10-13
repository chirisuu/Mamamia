"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TagInputProps = {
  id: string;
  label: string;
  placeholder?: string;
  /** Etiquetas libres (las que no están entre las opciones fijas). */
  value: readonly string[];
  onChange: (value: string[]) => void;
  max?: number;
  hint?: string;
};

/** Lista libre: escribe y agrega con Enter o con el botón; cada etiqueta se puede quitar. */
export function TagInput({ id, label, placeholder, value, onChange, max = 20, hint }: TagInputProps) {
  const [draft, setDraft] = React.useState("");
  const full = value.length >= max;

  function add() {
    const items = draft
      .split(",")
      .map((s) => s.trim().slice(0, 60))
      .filter(Boolean);
    if (items.length === 0) return;
    const next = [...value];
    for (const item of items) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLocaleLowerCase("es") === item.toLocaleLowerCase("es"))) next.push(item);
    }
    onChange(next);
    setDraft("");
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          placeholder={placeholder}
          maxLength={120}
          disabled={full}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="secondary" size="icon" onClick={add} disabled={full || !draft.trim()} aria-label={`Agregar a ${label.toLowerCase()}`}>
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={label}>
          {value.map((tag) => (
            <li key={tag}>
              <span className="inline-flex min-h-11 items-center gap-1 rounded-full border-2 border-primary bg-accent pl-4 pr-0 text-sm font-medium text-accent-foreground">
                {tag}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== tag))}
                  aria-label={`Quitar ${tag}`}
                  className="inline-flex size-11 items-center justify-center rounded-full outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {full ? <p className="text-sm text-muted-foreground">Llegaste al máximo de {max}.</p> : null}
    </div>
  );
}
