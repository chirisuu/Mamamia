import * as React from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AppHeaderProps = Omit<React.ComponentProps<"header">, "title"> & {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Botones de icono a la derecha (cada uno con aria-label). */
  actions?: React.ReactNode;
  /** Muestra un botón atrás que navega a esta ruta. */
  backHref?: string;
  backLabel?: string;
};

/**
 * Encabezado de pantalla del área de usuario. Fijo arriba con fondo translúcido y safe area.
 * El título es el h1 de la pantalla. Pensado para ir como primer hijo del <main> del AppShell.
 */
function AppHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = "Volver",
  className,
  ...props
}: AppHeaderProps) {
  return (
    <header
      data-slot="app-header"
      className={cn(
        // -mx-4/px-4: ocupa todo el ancho dentro del <main> del AppShell (que tiene px-4 en móvil).
        "sticky top-0 z-30 -mx-4 bg-background/85 px-4 pt-safe backdrop-blur-lg supports-[backdrop-filter]:bg-background/70 lg:mx-0 lg:px-0",
        className,
      )}
      {...props}
    >
      <div className="flex min-h-16 items-center gap-2 py-2">
        {backHref ? (
          <Button asChild variant="ghost" size="icon-sm" className="-ml-2 rounded-full">
            <Link href={backHref} aria-label={backLabel}>
              <ChevronLeft className="size-6" aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground lg:text-2xl">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
    </header>
  );
}

export { AppHeader, type AppHeaderProps };
