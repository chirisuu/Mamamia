import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Marca de ORANGE FIT (diseño propio): un anillo de progreso naranja casi cerrado y un punto
 * que marca la meta en el hueco. Lectura: "avanzas hacia tu objetivo, a tu ritmo".
 * Geometría (viewBox 48): centro 24, radio 17, trazo 7. El arco va de 58° a 342° en sentido
 * horario (desde las 12 en punto) y el punto se ubica a 20°, centrado en el hueco.
 * El arco usa el naranja de marca en ambos temas; el punto hereda currentColor (carbón en claro,
 * blanco suave en oscuro) para que la marca funcione sobre cualquier fondo.
 */
const ARC_PATH = "M38.42 14.99 A17 17 0 1 1 18.75 7.83";

type LogoMarkProps = React.ComponentProps<"svg"> & {
  /** Si se pasa, la marca se anuncia como imagen con este nombre; si no, es decorativa. */
  title?: string;
};

function LogoMark({ className, title, ...props }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      data-slot="logo-mark"
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={ARC_PATH} className="stroke-brand-orange" strokeWidth={7} strokeLinecap="round" />
      <circle cx="29.81" cy="8.03" r="4.2" className="fill-current" />
    </svg>
  );
}

type LogoProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Nombre vigente de la app (configurable en /admin/configuracion). */
  appName: string;
  markClassName?: string;
  wordmarkClassName?: string;
  /** Solo la marca, con el nombre como texto accesible. */
  iconOnly?: boolean;
};

/** Logotipo: marca + nombre. El nombre es texto real (accesible, traducible, configurable). */
function Logo({ appName, className, markClassName, wordmarkClassName, iconOnly = false, ...props }: LogoProps) {
  return (
    <span data-slot="logo" className={cn("inline-flex items-center gap-2.5 text-foreground", className)} {...props}>
      <LogoMark className={markClassName} />
      {iconOnly ? (
        <span className="sr-only">{appName}</span>
      ) : (
        <span className={cn("text-lg font-bold leading-none tracking-tight", wordmarkClassName)}>{appName}</span>
      )}
    </span>
  );
}

export { Logo, LogoMark, type LogoProps, type LogoMarkProps };
