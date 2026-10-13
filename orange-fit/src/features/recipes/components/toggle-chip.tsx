"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Chip seleccionable (botón con aria-pressed), 44 px de alto. El estado se ve por color y por el check. */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
  className,
  disabled,
}: {
  pressed: boolean;
  onPressedChange: (next: boolean) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        pressed ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {pressed ? <Check className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
