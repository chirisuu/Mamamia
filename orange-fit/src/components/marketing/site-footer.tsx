import type * as React from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

type SiteFooterProps = {
  appName: string;
  /** Correo de soporte (app_settings.support_email). Si no hay, no se muestra el enlace de contacto. */
  supportEmail?: string | null;
  className?: string;
};

const PRODUCT_LINKS = [
  { href: "/funciones", label: "Funciones" },
  { href: "/precios", label: "Precios" },
  { href: "/faq", label: "Preguntas frecuentes" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/terminos", label: "Términos y condiciones" },
  { href: "/legal/privacidad", label: "Política de privacidad" },
  { href: "/legal/datos-de-salud", label: "Tratamiento de datos de salud" },
] as const;

const linkClass =
  "rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Pie del sitio público con enlaces legales y aviso de salud. */
export function SiteFooter({ appName, supportEmail, className }: SiteFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer data-slot="site-footer" className={cn("border-t border-border bg-card pb-safe", className)}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Logo appName={appName} />
          <p className="max-w-xs text-sm text-muted-foreground">
            Nutrición y seguimiento pensados para tu día a día, sin dietas extremas.
          </p>
        </div>

        <FooterColumn title="Producto">
          {PRODUCT_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Legal">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className={linkClass}>
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Contacto">
          {supportEmail ? (
            <li>
              <a href={`mailto:${supportEmail}`} className={cn(linkClass, "break-all")}>
                {supportEmail}
              </a>
            </li>
          ) : (
            <li className="text-sm text-muted-foreground">Canal de contacto pendiente de configurar.</li>
          )}
        </FooterColumn>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:px-6">
          <p className="max-w-3xl leading-relaxed">
            {appName} ofrece información general sobre alimentación y actividad física.{" "}
            <strong className="font-semibold text-foreground">No reemplaza a un profesional de la salud.</strong> Si
            tienes una condición médica, estás embarazada o en lactancia, o tomas medicación, consulta con tu médico o
            nutricionista antes de cambiar tu alimentación.
          </p>
          <p>
            © {year} {appName}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}
