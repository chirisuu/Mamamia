"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { OfflineBanner } from "@/components/app/offline-banner";
import {
  APP_PRIMARY_NAV,
  APP_SECONDARY_NAV,
  QUICK_ADD_ACTIONS,
  isNavItemActive,
  type NavItem,
} from "@/components/app/nav-items";
import { cn } from "@/lib/utils";

type AppShellProps = {
  /** Nombre vigente de la app (lo lee el layout de /app con getAppSettings()). */
  appName: string;
  children: React.ReactNode;
};

/**
 * Marco del área de usuario.
 * - Móvil: barra inferior fija (5 secciones) + botón "+" flotante centrado que abre un bottom sheet.
 * - Escritorio (≥ lg): barra lateral con las mismas secciones, extras y botón "Registrar" (diálogo).
 * El contenido va en <main id="contenido"> con margen inferior para no quedar bajo la barra.
 */
export function AppShell({ appName, children }: AppShellProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <div data-slot="app-shell" className="min-h-dvh bg-background">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(env(safe-area-inset-top)+1rem)] focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <DesktopSidebar appName={appName} pathname={pathname} onAdd={() => setDialogOpen(true)} />

      <div className="lg:pl-72">
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+9.5rem)] outline-none lg:max-w-5xl lg:px-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      <OfflineBanner className="fixed inset-x-4 bottom-safe-38 z-40 mx-auto max-w-md lg:inset-x-auto lg:bottom-6 lg:right-8 lg:w-96" />

      {/* Móvil: barra inferior */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/90 pb-safe px-safe backdrop-blur-lg supports-[backdrop-filter]:bg-card/80 lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          {APP_PRIMARY_NAV.map((item) => (
            <li key={item.href} className="flex flex-1">
              <TabBarLink item={item} active={isNavItemActive(pathname, item)} />
            </li>
          ))}
        </ul>
      </nav>

      {/* Móvil: botón principal "+" y sus accesos */}
      <BottomSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <BottomSheetTrigger asChild>
          <button
            type="button"
            aria-label="Registrar comida, agua, actividad o ayuno"
            className={cn(
              "fixed bottom-safe-19 left-1/2 z-40 inline-flex size-15 -translate-x-1/2 items-center justify-center rounded-full lg:hidden",
              "bg-primary text-primary-foreground shadow-float transition-[scale,background-color] duration-150 hover:bg-primary/90 active:scale-95",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
          >
            <Plus className="size-7" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </BottomSheetTrigger>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Registrar</BottomSheetTitle>
            <BottomSheetDescription>Elige cómo quieres agregarlo.</BottomSheetDescription>
          </BottomSheetHeader>
          <QuickAddGrid onSelect={() => setSheetOpen(false)} className="px-5 pt-2" />
        </BottomSheetContent>
      </BottomSheet>

      {/* Escritorio: mismos accesos en un diálogo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar</DialogTitle>
            <DialogDescription>Elige cómo quieres agregarlo.</DialogDescription>
          </DialogHeader>
          <QuickAddGrid onSelect={() => setDialogOpen(false)} columns={4} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabBarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium tap-highlight-none",
        "text-muted-foreground transition-colors duration-150 hover:text-foreground",
        "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        active && "font-semibold text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 h-1 w-8 rounded-b-full bg-primary transition-opacity duration-150",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon className={cn("size-6", active && "text-primary-strong")} strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function DesktopSidebar({
  appName,
  pathname,
  onAdd,
}: {
  appName: string;
  pathname: string | null;
  onAdd: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-20 items-center px-6">
        <Link
          href="/app"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          <Logo appName={appName} />
        </Link>
      </div>

      <div className="px-4">
        <Button className="w-full" onClick={onAdd}>
          <Plus aria-hidden="true" />
          Registrar
        </Button>
      </div>

      <nav aria-label="Navegación principal" className="mt-6 flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-6">
        <SidebarList items={APP_PRIMARY_NAV} pathname={pathname} />
        <div className="flex flex-col gap-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Más</p>
          <SidebarList items={APP_SECONDARY_NAV} pathname={pathname} />
        </div>
      </nav>

      <div className="flex items-center justify-between border-t border-border px-6 py-4">
        <span className="text-sm text-muted-foreground">Tema</span>
        <ThemeToggle align="end" />
      </div>
    </aside>
  );
}

function SidebarList({ items, pathname }: { items: readonly NavItem[]; pathname: string | null }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isNavItemActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground",
                "transition-colors duration-150 hover:bg-accent hover:text-accent-foreground",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-accent font-semibold text-accent-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "text-primary-strong")} aria-hidden="true" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Rejilla de accesos rápidos del botón "+". Cierra el contenedor al elegir. */
function QuickAddGrid({
  onSelect,
  columns = 2,
  className,
}: {
  onSelect: () => void;
  columns?: 2 | 4;
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-2", columns === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2", className)}>
      {QUICK_ADD_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <li key={action.href}>
            <Link
              href={action.href}
              onClick={onSelect}
              className={cn(
                "flex h-full min-h-20 flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left",
                "transition-colors duration-150 hover:border-primary/50 hover:bg-accent/50",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary-strong">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{action.label}</span>
                <span className="text-xs text-muted-foreground">{action.description}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
