import type { Metadata } from "next";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authUiConfig, firstParam, type SearchParams } from "@/features/auth/server/config";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { RecoverForm } from "@/features/auth/components/recover-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default async function RecoverPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { siteUrl } = authUiConfig();

  return (
    <>
      <AuthHeading
        title="Recupera tu contraseña"
        description="Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva."
      />
      {firstParam(params, "error") === "enlace" ? (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>El enlace venció o ya se usó</AlertTitle>
          <AlertDescription>
            <p>Pide uno nuevo aquí abajo. Cada enlace sirve una sola vez y dura 1 hora.</p>
          </AlertDescription>
        </Alert>
      ) : null}
      <RecoverForm siteUrl={siteUrl} />
    </>
  );
}
