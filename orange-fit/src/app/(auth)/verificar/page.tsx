import type { Metadata } from "next";
import { safeNext } from "@/features/auth/redirect";
import { authUiConfig, firstParam, type SearchParams } from "@/features/auth/server/config";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { VerifyEmail } from "@/features/auth/components/verify-email";

export const metadata: Metadata = { title: "Verifica tu correo", robots: { index: false } };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const fromOnboarding = firstParam(params, "from") === "onboarding";
  const next = fromOnboarding ? "/onboarding" : safeNext(firstParam(params, "next"));
  const { siteUrl } = authUiConfig();

  return (
    <>
      <AuthHeading title="Confirma tu correo" description="Un paso más y tu cuenta queda lista." />
      <VerifyEmail
        siteUrl={siteUrl}
        next={next}
        linkError={firstParam(params, "error") === "enlace"}
        resent={firstParam(params, "reenviado") === "1"}
      />
    </>
  );
}
