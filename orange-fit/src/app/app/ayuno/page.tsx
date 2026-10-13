import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake, ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/app/app-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FastingHistory, FastingStatsTiles } from "@/features/fasting/components/fasting-history";
import { FastingStartForm } from "@/features/fasting/components/fasting-start-form";
import { FastingTimer } from "@/features/fasting/components/fasting-timer";
import type { FastingEligibility } from "@/features/fasting/lib/eligibility";
import { getFastingEligibility, getFastingPageData, type FastingPageData } from "@/features/fasting/server/fasting";
import { ReminderSettings } from "@/features/notifications/components/reminder-settings";
import { getTrackingContext } from "@/features/progress/server/tracking-context";
import { isPushConfigured } from "@/lib/notifications/push";
import { parseNotificationPrefs } from "@/lib/notifications/prefs";

export const metadata: Metadata = { title: "Ayuno" };

function SafetyNotice() {
  return (
    <Alert variant="warning">
      <ShieldAlert aria-hidden="true" />
      <AlertTitle>Antes de ayunar</AlertTitle>
      <AlertDescription>
        <ul className="mt-1 grid list-disc gap-1 pl-4">
          <li>El ayuno intermitente es opcional: no es necesario para cuidar tu alimentación ni para avanzar.</li>
          <li>Durante el ayuno toma agua. Si sientes mareo, debilidad, palpitaciones o malestar, termínalo y come algo.</li>
          <li>No ofrecemos ayunos de más de 24 horas. Esto no reemplaza la indicación de un profesional de salud.</li>
          <li>
            No es recomendable si estás embarazada o dando de lactar, si eres menor de edad, si tienes o tuviste un trastorno de
            la conducta alimentaria, diabetes con medicación u otra condición médica sin acompañamiento profesional.
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function Blocked({ eligibility }: { eligibility: FastingEligibility }) {
  const missing = eligibility.code === "missing_data";
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2" className="flex items-center gap-2">
          <HeartHandshake className="size-5 text-primary-strong" aria-hidden="true" />
          {missing ? "Completa tu perfil para ver el ayuno" : "El ayuno no está disponible para ti en la app"}
        </CardTitle>
        <CardDescription>{eligibility.reason}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {eligibility.blockedBy.length > 0 ? (
          <p>
            Lo decidimos por lo que nos contaste: {eligibility.blockedBy.join(", ").toLowerCase()}. No es un juicio: en estas
            situaciones, ayunar sin acompañamiento puede no ser seguro.
          </p>
        ) : null}
        {!missing ? (
          <p className="text-muted-foreground">
            Puedes seguir registrando tus comidas, tu agua y tu actividad con normalidad. Si tu situación cambió, actualiza tu
            información de salud.
          </p>
        ) : null}
        <Button asChild variant="outline" className="justify-self-start">
          <Link href={missing ? "/app/perfil/datos" : "/app/perfil/metas"}>{missing ? "Completar mis datos" : "Revisar mis metas"}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default async function FastingPage() {
  const ctx = await getTrackingContext("/app/ayuno");
  const [data, eligibility] = await Promise.all([
    getFastingPageData(ctx.supabase, ctx.user.id).catch((): FastingPageData | null => null),
    getFastingEligibility(ctx.supabase, ctx.user.id, ctx.today).catch((): FastingEligibility | null => null),
  ]);
  const prefs = parseNotificationPrefs(ctx.profile?.notification_prefs);

  if (!data || !eligibility) {
    return (
      <>
        <AppHeader title="Ayuno" backHref="/app" backLabel="Volver a Inicio" />
        <Alert variant="destructive" className="mt-2">
          <AlertTitle>No pudimos cargar tu ayuno</AlertTitle>
          <AlertDescription>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <Link href="/app/ayuno" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary-strong underline-offset-4 hover:underline">
              Reintentar
            </Link>
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const blocked = !eligibility.allowed && eligibility.code !== "active_session";

  return (
    <>
      <AppHeader title="Ayuno" subtitle="Intermitente, opcional y a tu ritmo" backHref="/app" backLabel="Volver a Inicio" />
      <div className="grid gap-6 pt-2 lg:grid-cols-2 lg:items-start">
        <div className="grid gap-4">
          {data.active ? <FastingTimer session={data.active} nowIso={ctx.now.toISOString()} timeZone={ctx.timeZone} /> : null}
          {!data.active && blocked ? <Blocked eligibility={eligibility} /> : null}
          {!data.active && !blocked ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Iniciar un ayuno</CardTitle>
                <CardDescription>El temporizador sigue aunque cierres la app.</CardDescription>
              </CardHeader>
              <CardContent>
                <FastingStartForm cautions={eligibility.cautions} />
              </CardContent>
            </Card>
          ) : null}
          {data.active && blocked ? (
            <p className="text-sm text-muted-foreground">
              Según tu información de salud actual, no podrás iniciar nuevos ayunos desde la app. Te recomendamos terminar este.
            </p>
          ) : null}
          <SafetyNotice />
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle as="h2">Tus estadísticas</CardTitle>
              <CardDescription>Solo cuentan los ayunos terminados (los cancelados no).</CardDescription>
            </CardHeader>
            <CardContent>
              <FastingStatsTiles stats={data.stats} reachedCount={data.reachedCount} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle as="h2">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              <FastingHistory sessions={data.history} timeZone={ctx.timeZone} />
            </CardContent>
          </Card>
          {!blocked || data.active ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Aviso al completar</CardTitle>
                <CardDescription>
                  {isPushConfigured()
                    ? "Con la app abierta te avisamos en este dispositivo; si activaste las notificaciones push, también con la app cerrada."
                    : "Con la app abierta te avisamos en este dispositivo. Las notificaciones push (con la app cerrada) están pendientes de configurar; el aviso igual queda en la app."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReminderSettings prefs={prefs} sections={["fasting"]} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
