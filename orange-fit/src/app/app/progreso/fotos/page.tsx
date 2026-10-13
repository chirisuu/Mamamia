import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONSENT_INFO } from "@/features/auth/consents";
import { PhotoConsent } from "@/features/progress/components/photo-consent";
import { PhotoGallery } from "@/features/progress/components/photo-gallery";
import { PhotoUploader } from "@/features/progress/components/photo-uploader";
import { hasPhotoConsent, listPhotos, type ProgressPhoto } from "@/features/progress/server/photos";
import { getTrackingContext } from "@/features/progress/server/tracking-context";

export const metadata: Metadata = { title: "Fotos de progreso" };

export default async function ProgressPhotosPage() {
  const ctx = await getTrackingContext("/app/progreso/fotos");
  const [consent, photos] = await Promise.all([
    hasPhotoConsent(ctx.supabase, ctx.user.id).catch((): boolean | null => null),
    listPhotos(ctx.supabase, ctx.user.id).catch((): ProgressPhoto[] | null => null),
  ]);

  return (
    <>
      <AppHeader title="Fotos de progreso" subtitle="Privadas, solo para ti" backHref="/app/progreso" backLabel="Volver a Progreso" />
      <div className="grid gap-6 pt-2 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        <div className="grid gap-4">
          {ctx.hideWeight ? (
            <Alert variant="info">
              <HeartHandshake aria-hidden="true" />
              <AlertTitle>Las fotos son totalmente opcionales</AlertTitle>
              <AlertDescription>
                Si comparar tu cuerpo te genera malestar, no necesitas usarlas: tu avance también se ve en tus hábitos. Si te
                acompaña un profesional de salud, conversa con él o ella si te conviene.
              </AlertDescription>
            </Alert>
          ) : null}

          {consent === null ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos revisar tus permisos</AlertTitle>
              <AlertDescription>
                <p>Revisa tu conexión y vuelve a intentarlo.</p>
                <Link
                  href="/app/progreso/fotos"
                  className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline"
                >
                  Reintentar
                </Link>
              </AlertDescription>
            </Alert>
          ) : consent ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Nueva foto</CardTitle>
                <CardDescription>Desde la cámara o tu galería. Se guarda en tu espacio privado.</CardDescription>
              </CardHeader>
              <CardContent>
                <PhotoUploader today={ctx.today} />
              </CardContent>
            </Card>
          ) : (
            <PhotoConsent description={CONSENT_INFO.progress_photos.description} />
          )}
        </div>

        <div className="grid gap-4">
          {photos === null ? (
            <Alert variant="destructive">
              <AlertTitle>No pudimos cargar tus fotos</AlertTitle>
              <AlertDescription>Revisa tu conexión y vuelve a intentarlo. Tus fotos no se perdieron.</AlertDescription>
            </Alert>
          ) : (
            <>
              {consent === false && photos.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Retiraste el permiso de fotos: no puedes subir nuevas, pero aún puedes ver y borrar las que guardaste.
                </p>
              ) : null}
              {consent || photos.length > 0 ? <PhotoGallery photos={photos} /> : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
