import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SpinnerProps = React.ComponentProps<typeof LoaderCircle> & {
  /** Texto para lectores de pantalla. Si el spinner es decorativo, pasa aria-hidden. */
  label?: string;
};

/** Indicador de carga. Con movimiento reducido queda estático (ver globals.css). */
function Spinner({ className, label = "Cargando", ...props }: SpinnerProps) {
  return (
    <LoaderCircle
      role="status"
      aria-label={label}
      data-slot="spinner"
      className={cn("size-5 animate-spin text-current", className)}
      {...props}
    />
  );
}

export { Spinner };
