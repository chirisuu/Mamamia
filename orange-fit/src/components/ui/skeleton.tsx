import * as React from "react";
import { cn } from "@/lib/utils";

/** Bloque de carga. El contenedor que lo usa debe marcar aria-busy="true". */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
