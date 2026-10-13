import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/features/auth/redirect";
import { authUiConfig, firstParam, type SearchParams } from "@/features/auth/server/config";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const fromOnboarding = firstParam(params, "from") === "onboarding";
  const next = fromOnboarding ? "/onboarding" : safeNext(firstParam(params, "next"));
  if (await getUser()) redirect(next);
  const { siteUrl, googleEnabled } = authUiConfig();

  return (
    <>
      <AuthHeading
        title={fromOnboarding ? "Crea tu cuenta para guardar tu plan" : "Crea tu cuenta"}
        description={
          fromOnboarding
            ? "Tus respuestas siguen en este dispositivo. Al confirmar tu correo e ingresar, guardamos tu plan."
            : "Es gratis. Luego te haremos unas preguntas para calcular tus metas."
        }
      />
      {fromOnboarding ? (
        <Alert variant="info" className="mb-6">
          <Sparkles aria-hidden="true" />
          <AlertTitle>Tu plan está listo</AlertTitle>
          <AlertDescription>
            <p>Abre el enlace de confirmación en este mismo dispositivo para no perder tus respuestas.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <RegisterForm next={next} siteUrl={siteUrl} googleEnabled={googleEnabled} fromOnboarding={fromOnboarding} />
    </>
  );
}
