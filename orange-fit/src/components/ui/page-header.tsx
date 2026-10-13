import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Texto pequeño sobre el título (sección, fecha). */
  eyebrow?: React.ReactNode;
  /** Botones a la derecha (debajo en móvil). */
  actions?: React.ReactNode;
  /** Nivel del título; h1 por defecto (uno por página). */
  as?: "h1" | "h2";
};

/** Encabezado de página para contenido (marketing, admin, secciones amplias de la app). */
function PageHeader({ title, description, eyebrow, actions, as: Heading = "h1", className, ...props }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-strong">{eyebrow}</p>
        ) : null}
        <Heading className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</Heading>
        {description ? <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export { PageHeader, type PageHeaderProps };
