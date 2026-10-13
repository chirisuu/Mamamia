import type { Metadata } from "next";
import { Crown, FileText, Moon, ShieldCheck, Stethoscope, Target, UserRound, LogOut } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getProfile, getRoles, hasRole, requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/entitlements";
import { LEGAL_LINKS } from "@/features/auth/consents";
import { InstallAppRow } from "@/features/profile/components/install-app-row";
import { ProfileLinkRow, ProfileRowGroup } from "@/features/profile/components/profile-link-row";
import Link from "next/link";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfileHubPage() {
  const user = await requireUser("/app/perfil");
  const [profile, roles, entitlements] = await Promise.all([getProfile(), getRoles(), getEntitlements()]);
  const name = profile?.display_name || user.email || "Tu cuenta";
  const isProfessional = hasRole(roles, "professional");

  return (
    <>
      <AppHeader title="Perfil" />
      <div className="grid gap-6 pb-8 pt-2">
        <section aria-label="Tu cuenta" className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <Avatar className="size-14 text-lg">
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{name}</p>
            {user.email ? <p className="truncate text-sm text-muted-foreground">{user.email}</p> : null}
          </div>
          <Badge variant={entitlements.isPremium ? "default" : "secondary"}>{entitlements.isPremium ? "Premium" : "Gratis"}</Badge>
        </section>

        <ProfileRowGroup label="Tu cuenta">
          <ProfileLinkRow href="/app/perfil/datos" icon={UserRound} label="Datos personales" description="Nombre, edad, estatura y zona horaria" />
          <ProfileLinkRow href="/app/perfil/metas" icon={Target} label="Metas y objetivo" description="Calorías, macros y cómo se calcularon" />
          <ProfileLinkRow href="/app/perfil/privacidad" icon={ShieldCheck} label="Privacidad y datos" description="Permisos, descarga y eliminación" />
          <ProfileLinkRow
            href="/app/perfil/suscripcion"
            icon={Crown}
            label="Suscripción"
            description={entitlements.isPremium ? "Tu plan Premium" : "Plan gratis · ver Premium"}
          />
          <ProfileLinkRow
            href="/app/perfil/profesional"
            icon={Stethoscope}
            label="Acceso profesional"
            description={isProfessional ? "Tus pacientes y quién te dio acceso" : "Comparte tus datos con tu nutricionista"}
          />
        </ProfileRowGroup>

        <ProfileRowGroup label="Preferencias">
          <div className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
              <Moon className="size-5" aria-hidden="true" />
            </span>
            <span className="flex-1 font-medium">Tema</span>
            <ThemeToggle />
          </div>
          <InstallAppRow />
        </ProfileRowGroup>

        <form action="/auth/salir" method="post">
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <LogOut aria-hidden="true" />
            Cerrar sesión
          </Button>
        </form>

        <footer className="grid gap-2 text-center text-xs text-muted-foreground">
          <nav aria-label="Legal" className="flex justify-center gap-4">
            <Link href={LEGAL_LINKS.terms} className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline">
              <FileText className="size-3.5" aria-hidden="true" /> Términos
            </Link>
            <Link href={LEGAL_LINKS.privacy} className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> Privacidad
            </Link>
          </nav>
          <p>Las metas son estimaciones y no reemplazan a un profesional de la salud.</p>
        </footer>
      </div>
    </>
  );
}
