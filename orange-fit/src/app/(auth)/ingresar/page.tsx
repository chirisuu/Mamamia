import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getUser } from "@/lib/auth/session";
import { safeNext } from "@/features/auth/redirect";
import { authUiConfig, firstParam, type SearchParams } from "@/features/auth/server/config";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(firstParam(params, "next"));
  if (await getUser()) redirect(next);
  const { siteUrl, googleEnabled } = authUiConfig();
  const oauthError = firstParam(params, "error") === "oauth";

  return (
    <>
      <AuthHeading title="Ingresa a tu cuenta" description="Sigue con tu registro donde lo dejaste." />
      {oauthError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>No pudimos completar el ingreso con Google</AlertTitle>
          <AlertDescription>
            <p>Puede que hayas cancelado o que el enlace haya vencido. Inténtalo otra vez o usa tu correo.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={next} siteUrl={siteUrl} googleEnabled={googleEnabled} />
    </>
  );
}
