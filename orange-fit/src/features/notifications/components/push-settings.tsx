"use client";

import * as React from "react";
import { BellOff, BellRing, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { sendTestNotificationAction } from "../actions";
import { getActiveRegistration, urlBase64ToUint8Array } from "../lib/browser-push";

type Props = {
  /** VAPID configurado en el servidor. */
  configured: boolean;
  publicKey: string | null;
};

type Status = "checking" | "unsupported" | "denied" | "off" | "on";

async function postSubscription(sub: PushSubscription): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, message: body?.error?.message ?? "No se pudo activar en este dispositivo." };
  } catch {
    return { ok: false, message: "Sin conexión. Inténtalo de nuevo." };
  }
}

/**
 * Activa o desactiva las notificaciones push en ESTE navegador. Si el servidor no tiene VAPID, lo
 * dice: los avisos siguen apareciendo dentro de la app.
 */
export function PushSettings({ configured, publicKey }: Props) {
  const [status, setStatus] = React.useState<Status>("checking");
  const [busy, setBusy] = React.useState(false);
  const [testing, startTest] = React.useTransition();

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return setStatus("unsupported");
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      if (!cancelled) setStatus(sub ? "on" : "off");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        toast.info("No activamos los avisos: el navegador no dio permiso.");
        return;
      }
      const reg = await getActiveRegistration();
      if (!reg) {
        toast.error("Este navegador no pudo preparar el servicio de notificaciones. Recarga la página e inténtalo de nuevo.");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const saved = await postSubscription(sub);
      if (!saved.ok) {
        await sub.unsubscribe().catch(() => undefined);
        toast.error(saved.message);
        setStatus("off");
        return;
      }
      setStatus("on");
      toast.success("Listo: recibirás avisos en este dispositivo.");
    } catch {
      toast.error("No se pudo activar en este dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
      }
      setStatus("off");
      toast.success("Desactivamos los avisos en este dispositivo.");
    } catch {
      toast.error("No se pudo desactivar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function sendTest() {
    startTest(async () => {
      const res = await sendTestNotificationAction();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      if (!res.data.pushConfigured) toast.success("Creamos una notificación de prueba dentro de la app.");
      else if (res.data.pushed > 0) toast.success("Enviamos una notificación de prueba a tus dispositivos.");
      else toast.info("La prueba quedó en la app, pero no hay dispositivos activos para recibirla.");
    });
  }

  if (!configured || !publicKey) {
    return (
      <div className="grid gap-3">
        <Alert variant="info">
          <BellOff aria-hidden="true" />
          <AlertTitle>Avisos al dispositivo pendientes de configurar</AlertTitle>
          <AlertDescription>
            Este servidor aún no tiene activadas las notificaciones push. Tus recordatorios aparecen dentro de la app, en
            esta pantalla y en Inicio.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={sendTest} loading={testing} className="justify-self-start">
          <Send aria-hidden="true" />
          Crear notificación de prueba
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {status === "checking"
          ? "Revisando este dispositivo…"
          : status === "unsupported"
            ? "Este navegador no permite notificaciones push. En iPhone, primero agrega la app a tu pantalla de inicio."
            : status === "denied"
              ? "Bloqueaste las notificaciones para este sitio. Puedes permitirlas desde la configuración del navegador."
              : status === "on"
                ? "Los avisos están activos en este dispositivo."
                : "Los avisos están apagados en este dispositivo."}
      </p>
      <div className="flex flex-wrap gap-3">
        {status === "on" ? (
          <Button variant="outline" onClick={() => void disable()} loading={busy}>
            <BellOff aria-hidden="true" />
            Desactivar en este dispositivo
          </Button>
        ) : (
          <Button onClick={() => void enable()} loading={busy} disabled={status !== "off"}>
            <BellRing aria-hidden="true" />
            Activar en este dispositivo
          </Button>
        )}
        <Button variant="ghost" onClick={sendTest} loading={testing}>
          <Send aria-hidden="true" />
          Enviar prueba
        </Button>
      </div>
    </div>
  );
}
