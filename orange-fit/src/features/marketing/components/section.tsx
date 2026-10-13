import type * as React from "react";
import { cn } from "@/lib/utils";

/** Encabezado de sección del sitio público: antetítulo, título (h2) e introducción. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = "left",
  tone = "default",
  className,
}: {
  id: string;
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: "left" | "center";
  /** "inverse" para bandas oscuras (carbón) en cualquier tema. */
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <div className={cn("grid max-w-2xl gap-3", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p
          className={cn(
            "text-sm font-semibold uppercase tracking-wider",
            tone === "inverse" ? "text-brand-amber" : "text-primary-strong",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className="scroll-mt-24 text-2xl font-semibold tracking-tight text-balance sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      {intro ? (
        <p className={cn("text-base leading-relaxed sm:text-lg", tone === "inverse" ? "text-brand-snow/80" : "text-muted-foreground")}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** Lista de puntos con viñeta naranja. */
export function PointList({
  items,
  tone = "default",
  className,
}: {
  items: Array<{ title: string; text: React.ReactNode }>;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-5", className)}>
      {items.map((item) => (
        <li key={item.title} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <span className="mt-2 size-2.5 rounded-full bg-primary" aria-hidden="true" />
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className={cn("col-start-2 text-sm leading-relaxed sm:text-base", tone === "inverse" ? "text-brand-snow/80" : "text-muted-foreground")}>
            {item.text}
          </p>
        </li>
      ))}
    </ul>
  );
}
