import Link from "next/link";
import { Camera, Droplet, Mic, ScanBarcode, Search, Timer, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTIONS: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/app/agregar/buscar", label: "Buscar", icon: Search },
  { href: "/app/agregar/foto", label: "Foto", icon: Camera },
  { href: "/app/agregar/voz", label: "Voz", icon: Mic },
  { href: "/app/agregar/codigo", label: "Código", icon: ScanBarcode },
  { href: "/app/agua", label: "Agua", icon: Droplet },
  { href: "/app/ayuno", label: "Ayuno", icon: Timer },
];

export function QuickActions() {
  return (
    <nav aria-labelledby="accesos-rapidos">
      <h2 id="accesos-rapidos" className="mb-3 text-base font-semibold">
        Accesos rápidos
      </h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ACTIONS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-2 text-sm font-medium",
                "transition-colors duration-150 hover:border-primary/50 hover:bg-accent/50",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-strong">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
