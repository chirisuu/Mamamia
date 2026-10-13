import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyRound } from "lucide-react";
import { getUser } from "@/lib/auth/session";
import { AuthHeading } from "@/features/auth/components/auth-heading";
import { NewPasswordForm } from "@/features/auth/components/new-password-form";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

/** Requiere la sesión que abre el enlace de recuperación (o una sesión normal, para cambiarla). */
export default async function NewPasswordPage() {
  const user = await getUser();
  if (!user) {
    return (
      <>
        <AuthHeading title="Crea una nueva contraseña" />
        <EmptyState
          icon={KeyRound}
          title="Abre el enlace de tu correo"
          description="Para cambiar tu contraseña necesitas el enlace que te enviamos. Si venció o ya lo usaste, pide uno nuevo."
          action={
            <Button asChild size="lg">
              <Link href="/recuperar">Pedir un enlace</Link>
            </Button>
          }
        />
      </>
    );
  }
  return (
    <>
      <AuthHeading
        title="Crea una nueva contraseña"
        description={
          <>
            Para <span className="font-medium text-foreground">{user.email}</span>. Después seguirás con tu sesión abierta.
          </>
        }
      />
      <NewPasswordForm />
    </>
  );
}
