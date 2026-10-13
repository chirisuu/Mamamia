import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/auth/session";
import { DEFAULT_TIMEZONE, isValidTimeZone, todayInTz } from "@/lib/dates";
import { ProfileForm } from "@/features/profile/components/profile-form";

export const metadata: Metadata = { title: "Datos personales" };

export default async function ProfileDataPage() {
  const user = await requireUser("/app/perfil/datos");
  const profile = await getProfile();
  const timezone = profile && isValidTimeZone(profile.timezone) ? profile.timezone : DEFAULT_TIMEZONE;

  return (
    <>
      <AppHeader title="Datos personales" backHref="/app/perfil" backLabel="Volver a Perfil" />
      <div className="grid gap-8 pb-10 pt-2">
        <ProfileForm
          today={todayInTz(timezone)}
          defaults={{
            displayName: profile?.display_name ?? "",
            birthDate: profile?.birth_date ?? null,
            sex: profile?.sex ?? null,
            heightCm: profile?.height_cm != null ? Number(profile.height_cm) : null,
            timezone,
            countryCode: profile?.country_code ?? "PE",
            currencyCode: profile?.currency_code ?? "PEN",
            countExerciseCalories: profile?.count_exercise_calories ?? false,
          }}
        />
        <section aria-labelledby="account-title" className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 id="account-title" className="font-semibold">
            Acceso
          </h2>
          <p className="text-sm text-muted-foreground">
            Correo: <span className="font-medium text-foreground">{user.email ?? "—"}</span>
          </p>
          <Button asChild variant="outline" className="justify-self-start">
            <Link href="/nueva-clave">
              <KeyRound aria-hidden="true" /> Cambiar contraseña
            </Link>
          </Button>
        </section>
      </div>
    </>
  );
}
