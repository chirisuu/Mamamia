import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCREENSHOTS, SCREENSHOT_SIZE, type ScreenshotKey } from "../content";

type ScreenshotFrameProps = {
  shot: ScreenshotKey;
  /** false si la captura aún no se generó: se muestra un marco que lo dice (nunca un mockup inventado). */
  available: boolean;
  /** Para la captura de la portada (visible al cargar): sin carga diferida y con prioridad alta. */
  priority?: boolean;
  className?: string;
};

/**
 * Captura REAL de la app dentro de un marco de teléfono. `<img>` con ancho/alto explícitos (sin
 * saltos de diseño) y alt descriptivo; carga diferida salvo la de la portada.
 */
export function ScreenshotFrame({ shot, available, priority = false, className }: ScreenshotFrameProps) {
  const { file, alt } = SCREENSHOTS[shot];
  return (
    <figure
      className={cn(
        "relative mx-auto w-full max-w-[17.5rem] rounded-[2.75rem] bg-brand-carbon p-2.5 shadow-lg ring-1 ring-brand-graphite",
        "dark:ring-border",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[2.25rem] bg-background" style={{ aspectRatio: `${SCREENSHOT_SIZE.width} / ${SCREENSHOT_SIZE.height}` }}>
        {available ? (
          // Captura estática servida desde /public: no necesita la optimización de next/image.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file}
            alt={alt}
            width={SCREENSHOT_SIZE.width}
            height={SCREENSHOT_SIZE.height}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            className="block h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-foreground">
            <Smartphone className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Captura en preparación</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{alt}</p>
          </div>
        )}
      </div>
    </figure>
  );
}
