"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  Bot,
  Bug,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  Menu,
  Newspaper,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { isNavItemActive, type NavItem } from "@/components/app/nav-items";
import { cn } from "@/lib/utils";

/** `adminOnly`: la página exige rol admin (un editor recibiría 404), así que no se le muestra. */
const ADMIN_NAV: readonly (NavItem & { adminOnly?: boolean })[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
  { href: "/admin/alimentos", label: "Alimentos", icon: Apple },
  { href: "/admin/recetas", label: "Recetas", icon: ChefHat },
  { href: "/admin/contenidos", label: "Contenidos", icon: Newspaper },
  { href: "/admin/planes", label: "Planes y precios", icon: CreditCard, adminOnly: true },
  { href: "/admin/ia", label: "IA", icon: Bot, adminOnly: true },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings, adminOnly: true },
  { href: "/admin/auditoria", label: "Auditoría", icon: ScrollText, adminOnly: true },
  { href: "/admin/errores", label: "Errores", icon: Bug, adminOnly: true },
];

type AdminShellProps = {
  appName: string;
  /** ¿Tiene rol admin (o superadmin)? Un editor solo ve alimentos, recetas y contenidos. */
  isAdmin: boolean;
  children: React.ReactNode;
};

/**
 * Marco del panel admin. Escritorio: barra lateral fija. Móvil/tablet: barra superior con
 * menú en sheet lateral. La autorización (requireRole) la hace el layout de /admin, no este componente.
 */
export function AdminShell({ appName, isAdmin, children }: AdminShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div data-slot="admin-shell" className="min-h-dvh bg-background">
      <a
        href="#contenido-admin"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <div className="flex h-18 items-center gap-2 px-5">
          <Link
            href="/admin"
            className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <Logo appName={appName} />
          </Link>
          <Badge variant="secondary">Admin</Badge>
        </div>
        <AdminNav pathname={pathname} isAdmin={isAdmin} className="flex-1 overflow-y-auto px-3 pb-6" />
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <Link href="/app" className="rounded-md text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Ir a la app
          </Link>
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 border-b border-border bg-card/90 pt-safe backdrop-blur-lg lg:hidden">
        <div className="flex h-16 items-center gap-2 px-4">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-ml-2 rounded-full" aria-label="Abrir menú de administración">
                <Menu className="size-6" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="gap-0">
              <SheetHeader className="flex-row items-center gap-2">
                <SheetTitle>
                  <Logo appName={appName} />
                </SheetTitle>
                <Badge variant="secondary">Admin</Badge>
                <SheetDescription className="sr-only">Secciones del panel de administración</SheetDescription>
              </SheetHeader>
              <AdminNav pathname={pathname} isAdmin={isAdmin} className="px-3 pb-safe-6" onNavigate={() => setMenuOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/admin" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo appName={appName} />
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            Admin
          </Badge>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="lg:pl-64">
        <main id="contenido-admin" tabIndex={-1} className="mx-auto w-full max-w-7xl px-4 py-6 outline-none sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

function AdminNav({
  pathname,
  isAdmin,
  className,
  onNavigate,
}: {
  pathname: string | null;
  isAdmin: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Administración" className={className}>
      <ul className="flex flex-col gap-1">
        {ADMIN_NAV.filter((item) => isAdmin || !item.adminOnly).map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
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
    </nav>
  );
}
