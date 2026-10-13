"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Camera, CircleCheck, NotebookPen, PackageSearch, Plus, RotateCcw, ScanBarcode } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/format";
import { BarcodeLookupError, fetchBarcode, isRetryableLookupError } from "../lib/lookup-client";
import type { MealChoice } from "../lib/meals";
import { BarcodeFoodCard } from "./barcode-food-card";
import { BarcodeLogForm } from "./barcode-log-form";
import { BarcodeScanner } from "./barcode-scanner";
import { ManualCodeForm } from "./manual-code-form";

export type BarcodeFlowProps = {
  localDate: string;
  isToday: boolean;
  meals: MealChoice[];
  defaultMeal: Pick<MealChoice, "mealType" | "customName">;
  /** Código a buscar al abrir (p. ej. al volver de crear el alimento propio). */
  initialCode: string | null;
  /** Query del destino (`fecha=…&comida=…`) para volver aquí desde otras pantallas. */
  targetQuery: string;
};

type CameraPermission = PermissionState | "unknown";

/** Escanear o escribir un código → ver el producto con su procedencia → registrarlo. */
export function BarcodeFlow({ localDate, isToday, meals, defaultMeal, initialCode, targetQuery }: BarcodeFlowProps) {
  const [code, setCode] = React.useState<string | null>(initialCode);
  const [scanning, setScanning] = React.useState(false);
  const [permission, setPermission] = React.useState<CameraPermission>("unknown");
  const [logged, setLogged] = React.useState<{ mealLabel: string; localDate: string } | null>(null);
  const manualRef = React.useRef<HTMLInputElement>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const autoStarted = React.useRef(false);

  // Si el permiso ya está concedido se abre la cámara directo; si está bloqueado se explica antes.
  React.useEffect(() => {
    let status: PermissionStatus | null = null;
    const update = () => status && setPermission(status.state);
    navigator.permissions
      ?.query({ name: "camera" as PermissionName })
      .then((s) => {
        status = s;
        setPermission(s.state);
        s.addEventListener("change", update);
        if (s.state === "granted" && !initialCode && !autoStarted.current) {
          autoStarted.current = true;
          setScanning(true);
        }
      })
      .catch(() => setPermission("unknown"));
    return () => status?.removeEventListener("change", update);
  }, [initialCode]);

  const lookup = useQuery({
    queryKey: ["barcode-lookup", code],
    queryFn: ({ signal }) => fetchBarcode(code as string, signal),
    enabled: code !== null,
    staleTime: 5 * 60_000,
    retry: (count, error) => isRetryableLookupError(error) && count < 1,
  });

  // La URL guarda el código para que recargar o volver atrás no lo pierda.
  React.useEffect(() => {
    const params = new URLSearchParams(targetQuery);
    if (code) params.set("codigo", code);
    const next = `/app/agregar/codigo?${params.toString()}`;
    if (`${window.location.pathname}${window.location.search}` !== next) window.history.replaceState(null, "", next);
  }, [code, targetQuery]);

  React.useEffect(() => {
    if (lookup.isSuccess || lookup.isError) resultRef.current?.focus();
  }, [lookup.isSuccess, lookup.isError, code]);

  const search = (next: string) => {
    setScanning(false);
    setLogged(null);
    setCode(next);
  };

  const scanAnother = () => {
    setCode(null);
    setLogged(null);
    setScanning(permission !== "denied");
    if (permission === "denied") requestAnimationFrame(() => manualRef.current?.focus());
  };

  const focusManual = () => {
    setScanning(false);
    requestAnimationFrame(() => manualRef.current?.focus());
  };

  const createOwnHref = (name?: string | null) => {
    const volver = new URLSearchParams(targetQuery);
    if (code) volver.set("codigo", code);
    const params = new URLSearchParams({ ...(code ? { codigo: code } : {}), ...(name ? { nombre: name } : {}), volver: `/app/agregar/codigo?${volver.toString()}` });
    return `/app/alimentos/nuevo?${params.toString()}`;
  };

  const liveMessage = !code
    ? ""
    : lookup.isPending
      ? `Buscando el código ${code}…`
      : lookup.isError
        ? lookup.error instanceof BarcodeLookupError
          ? lookup.error.message
          : "No pudimos buscar el producto."
        : lookup.data
          ? `Producto encontrado: ${lookup.data.food.name}`
          : "";

  return (
    <div className="flex flex-col gap-4 pb-8 pt-2">
      <p className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </p>

      {code === null ? (
        <>
          {scanning ? (
            <BarcodeScanner onDetected={search} onClose={() => setScanning(false)} onManual={focusManual} />
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary-strong">
                    <ScanBarcode className="size-6" aria-hidden="true" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-base font-semibold">Escanea el código del envase</h2>
                    <p className="text-sm text-muted-foreground">
                      Usamos la cámara solo para leer el código de barras, aquí en tu dispositivo. No tomamos fotos ni guardamos
                      imágenes.
                    </p>
                  </div>
                </div>
                {permission === "denied" ? (
                  <Alert variant="warning">
                    <AlertTitle>La cámara está bloqueada para este sitio</AlertTitle>
                    <AlertDescription>
                      <p>Actívala en tu navegador (ícono del candado → Cámara → Permitir) o escribe el código abajo.</p>
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button type="button" size="lg" onClick={() => setScanning(true)}>
                  <Camera aria-hidden="true" />
                  {permission === "denied" ? "Intentar con la cámara" : "Activar cámara"}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">o escríbelo</span>
            <Separator className="flex-1" />
          </div>
          <ManualCodeForm onSubmit={search} inputRef={manualRef} />
        </>
      ) : (
        <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
          {lookup.isPending ? (
            <div aria-busy="true" aria-label={`Buscando el código ${code}`} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Buscando <span className="tabular-nums">{code}</span> en nuestra base y en Open Food Facts…
              </p>
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
          ) : lookup.isError ? (
            <LookupProblem error={lookup.error} code={code} createOwnHref={createOwnHref} onRetry={() => void lookup.refetch()} retrying={lookup.isFetching} targetQuery={targetQuery} />
          ) : logged ? (
            <Alert variant="success">
              <CircleCheck aria-hidden="true" />
              <AlertTitle>Listo: agregado a {logged.mealLabel}</AlertTitle>
              <AlertDescription>
                <p>
                  {lookup.data.food.name} quedó en el diario de {logged.localDate === localDate && isToday ? "hoy" : formatShortDate(logged.localDate)}.
                </p>
                <Link
                  href={`/app/diario/${logged.localDate}`}
                  className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <NotebookPen className="size-4" aria-hidden="true" />
                  Ver el diario
                </Link>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <BarcodeFoodCard food={lookup.data.food} origin={lookup.data.origin} barcode={lookup.data.barcode} />
              <BarcodeLogForm
                food={lookup.data.food}
                localDate={localDate}
                isToday={isToday}
                meals={meals}
                defaultMeal={defaultMeal}
                onLogged={setLogged}
              />
            </>
          )}
          <Button type="button" variant="outline" onClick={scanAnother}>
            <ScanBarcode aria-hidden="true" />
            {logged ? "Escanear otro producto" : "Escanear otro código"}
          </Button>
        </div>
      )}
    </div>
  );
}

function LookupProblem({
  error,
  code,
  createOwnHref,
  onRetry,
  retrying,
  targetQuery,
}: {
  error: unknown;
  code: string;
  createOwnHref: (name?: string | null) => string;
  onRetry: () => void;
  retrying: boolean;
  targetQuery: string;
}) {
  const e = error instanceof BarcodeLookupError ? error : new BarcodeLookupError(0, "UNKNOWN", "No pudimos buscar el producto.");
  const createButton = (label = "Crear alimento propio") => (
    <Button asChild>
      <Link href={createOwnHref(e.product?.name)}>
        <Plus aria-hidden="true" />
        {label}
      </Link>
    </Button>
  );

  if (e.status === 404 || e.status === 422) {
    const title = e.code === "REJECTED" ? "Datos marcados como incorrectos" : e.status === 422 ? "Faltan datos de este producto" : "No encontramos este producto";
    return (
      <EmptyState
        icon={PackageSearch}
        title={title}
        description={
          <>
            {e.message} <span className="tabular-nums">({code})</span>
          </>
        }
        action={createButton()}
      />
    );
  }

  if (e.status === 401) {
    const next = `/app/agregar/codigo?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(targetQuery)), codigo: code }).toString()}`;
    return (
      <Alert variant="warning">
        <AlertTitle>Tu sesión expiró</AlertTitle>
        <AlertDescription>
          <p>Vuelve a ingresar para buscar el producto.</p>
          <Button asChild variant="secondary" size="sm">
            <Link href={`/ingresar?next=${encodeURIComponent(next)}`}>Ingresar</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const title =
    e.status === 429
      ? "Muchas consultas seguidas"
      : e.status === 502
        ? "Open Food Facts no respondió"
        : e.status === 503
          ? "No disponible por ahora"
          : e.status === 400
            ? "Código no válido"
            : "No pudimos buscar el producto";
  return (
    <Alert variant={e.status === 429 ? "warning" : "destructive"}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{e.message}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {e.status !== 400 ? (
            <Button type="button" variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
              {retrying ? null : <RotateCcw aria-hidden="true" />}
              Reintentar
            </Button>
          ) : null}
          {e.status === 502 || e.status === 503 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={createOwnHref(null)}>Crear alimento propio</Link>
            </Button>
          ) : null}
        </div>
      </AlertDescription>
    </Alert>
  );
}
