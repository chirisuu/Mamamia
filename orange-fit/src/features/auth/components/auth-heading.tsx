import type * as React from "react";

/** Título de cada pantalla de autenticación (h1 + bajada). */
export function AuthHeading({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="mb-8 grid gap-2">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description ? <p className="text-muted-foreground">{description}</p> : null}
    </div>
  );
}
