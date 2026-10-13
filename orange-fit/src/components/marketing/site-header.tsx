"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

const MARKETING_NAV = [
  { href: "/funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/faq", label: "Preguntas" },
] as const;

/** Encabezado del sitio público. En móvil, el menú vive en un sheet lateral. */
export function SiteHeader({ appName, className }: { appName: string; className?: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <header
      data-slot="site-header"
      className={cn(
        "sticky top-0 z-40 border-b border-border/60 bg-background/80 pt-safe backdrop-blur-lg supports-[backdrop-filter]:bg-background/65",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 lg:h-18">
        <Link
          href="/"
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo appName={appName} />
        </Link>

        <nav aria-label="Principal" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {MARKETING_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 items-center rounded-xl px-3.5 text-sm font-medium text-muted-foreground",
                      "transition-colors duration-150 hover:bg-accent hover:text-accent-foreground",
                      "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active && "text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle className="hidden md:inline-flex" />
          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link href="/ingresar">Ingresar</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/registro">Crear cuenta</Link>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="rounded-full md:hidden" aria-label="Abrir menú">
                <Menu className="size-6" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="gap-0">
              <SheetHeader>
                <SheetTitle>
                  <Logo appName={appName} />
                </SheetTitle>
                <SheetDescription className="sr-only">Menú de navegación del sitio</SheetDescription>
              </SheetHeader>
              <nav aria-label="Principal (móvil)" className="px-3">
                <ul className="flex flex-col gap-1">
                  {MARKETING_NAV.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        aria-current={pathname === item.href ? "page" : undefined}
                        className="flex h-12 items-center rounded-xl px-3 text-base font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="mt-auto flex flex-col gap-3 p-5 pb-safe-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tema</span>
                  <ThemeToggle align="end" />
                </div>
                <Button asChild variant="outline">
                  <Link href="/ingresar" onClick={() => setMenuOpen(false)}>
                    Ingresar
                  </Link>
                </Button>
                <Button asChild>
                  <Link href="/registro" onClick={() => setMenuOpen(false)}>
                    Crear cuenta
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
