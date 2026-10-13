import type * as React from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Fila navegable del centro de perfil (≥ 56 px, icono + texto + chevron). */
export function ProfileLinkRow({
  href,
  icon: Icon,
  label,
  description,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-14 items-center gap-3 px-4 py-3 outline-none transition-colors",
        "hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-medium">
          {label}
          {badge}
        </span>
        {description ? <span className="block truncate text-sm text-muted-foreground">{description}</span> : null}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/** Grupo de filas con borde (lista accesible). */
export function ProfileRowGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="grid gap-2">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">{label}</h2>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">{children}</div>
    </section>
  );
}
