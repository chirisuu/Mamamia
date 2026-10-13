"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, ImageUp, Info, RotateCcw, Sparkles, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import type { MealOption, MealType } from "@/features/diary/types";
import { AiApiError, analyzePhotoRequest } from "../lib/api-client";
import { shrinkImageForUpload } from "../lib/image-resize";
import { photoReviewItems } from "../lib/review";
import type { AiQuotaDto, PhotoAnalysisResponse } from "../schemas";
import { AiErrorView } from "./ai-error-view";
import { QuotaLine } from "./ai-notices";
import { ReviewPanel } from "./review-panel";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";

type PhotoFlowProps = {
  localDate: string;
  maxDate: string;
  defaultMeal: MealType;
  defaultCustomName: string | null;
  mealOptions: MealOption[];
  quota: AiQuotaDto;
  searchHref: string;
};

type Phase = "pick" | "analyzing" | "review" | "error";

/**
 * Registro por foto: tomar o subir → vista previa → análisis (cupo + IA + coincidencias en la base)
 * → revisión editable → confirmar. La foto solo se guarda si la persona lo elige.
 */
export function PhotoFlow({ localDate, maxDate, defaultMeal, defaultCustomName, mealOptions, quota: initialQuota, searchHref }: PhotoFlowProps) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [savePhoto, setSavePhoto] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>("pick");
  const [result, setResult] = React.useState<PhotoAnalysisResponse | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [quota, setQuota] = React.useState(initialQuota);

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);
  React.useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!chosen) return;
    if (!ACCEPT.split(",").includes(chosen.type)) {
      setFileError("Usa una foto JPG, PNG o WebP.");
      return;
    }
    if (chosen.size > 30 * 1024 * 1024) {
      setFileError("La foto es demasiado pesada. Usa una de menos de 8 MB.");
      return;
    }
    setFileError(null);
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
    setResult(null);
    setError(null);
    setPhase("pick");
  };

  const analyze = async () => {
    if (!file) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("analyzing");
    setError(null);
    try {
      const upload = await shrinkImageForUpload(file);
      if (upload.size > MAX_BYTES) {
        setFileError("La foto pesa más de 8 MB. Usa una más liviana.");
        setPhase("pick");
        return;
      }
      const res = await analyzePhotoRequest(upload, savePhoto, controller.signal);
      setResult(res);
      setQuota(res.quota);
      setPhase("review");
      if (res.photoSaved === false) toast.warning("El análisis se hizo, pero no pudimos guardar la foto en tu historial.");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPhase("pick");
        return;
      }
      if (e instanceof AiApiError && e.quota) setQuota(e.quota);
      setError(e);
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setFileError(null);
    setPhase("pick");
  };

  if (phase === "review" && result) {
    if (!result.isFoodImage) {
      return (
        <div className="grid gap-4">
          <PreviewImage src={preview} />
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>No vemos comida en esta foto</AlertTitle>
            <AlertDescription>
              <p>{result.uncertaintyNote ?? "Prueba con una foto donde el plato se vea completo y con buena luz."}</p>
            </AlertDescription>
          </Alert>
          <Button onClick={reset} size="lg">
            <RotateCcw aria-hidden="true" />
            Probar con otra foto
          </Button>
          <QuotaLine used={quota.used} limit={quota.limit} unit="análisis de fotos" />
        </div>
      );
    }
    return (
      <div className="grid gap-4">
        <PreviewImage src={preview} compact />
        <ReviewPanel
          requestId={result.requestId}
          source="photo_ai"
          initialItems={photoReviewItems(result.candidates)}
          localDate={localDate}
          maxDate={maxDate}
          defaultMeal={defaultMeal}
          defaultCustomName={defaultCustomName}
          mealOptions={mealOptions}
          uncertaintyNote={result.uncertaintyNote}
          onDiscard={reset}
        />
        <QuotaLine used={quota.used} limit={quota.limit} unit="análisis de fotos" />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <input ref={cameraRef} type="file" accept={ACCEPT} capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />
      <input ref={galleryRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />

      {preview ? (
        <PreviewImage src={preview} />
      ) : (
        <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 px-6 text-center">
          <Camera className="size-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Toma la foto desde arriba, con todo el plato a la vista y buena luz.</p>
        </div>
      )}
      {fileError ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {fileError}
        </p>
      ) : null}

      {phase === "analyzing" ? (
        <div aria-busy="true" aria-live="polite" className="grid gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary-strong" aria-hidden="true" />
            Analizando tu foto… puede tardar unos segundos.
          </p>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
            <X aria-hidden="true" />
            Cancelar
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={file ? "outline" : "default"} onClick={() => cameraRef.current?.click()}>
              <Camera aria-hidden="true" />
              {file ? "Otra foto" : "Tomar foto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => galleryRef.current?.click()}>
              <ImageUp aria-hidden="true" />
              Subir
            </Button>
          </div>

          {file ? (
            <>
              <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
                <Checkbox id="save-photo" checked={savePhoto} onCheckedChange={(v) => setSavePhoto(v === true)} className="mt-0.5" />
                <div className="grid gap-1">
                  <Label htmlFor="save-photo">Guardar la foto en mi historial privado</Label>
                  <p className="text-xs text-muted-foreground">Solo tú puedes verla. Si no la marcas, la foto se usa para el análisis y no se guarda.</p>
                </div>
              </div>
              <Button size="lg" onClick={analyze} disabled={quota.used >= quota.limit}>
                <Sparkles aria-hidden="true" />
                Analizar foto
              </Button>
            </>
          ) : null}

          {phase === "error" ? (
            <AiErrorView error={error} what="tus fotos de comida" onRetry={analyze} alternativeHref={searchHref} alternativeLabel="Buscar por nombre" />
          ) : null}

          <p className="text-xs text-muted-foreground">
            La foto se envía a un proveedor de IA externo solo para sugerir alimentos y porciones. Tú revisas y confirmas antes de registrar.{" "}
            <Link href="/app/perfil/privacidad" className="font-medium text-primary-strong underline-offset-4 hover:underline">
              Privacidad
            </Link>
          </p>
          <QuotaLine used={quota.used} limit={quota.limit} unit="análisis de fotos" />
        </>
      )}
    </div>
  );
}

function PreviewImage({ src, compact }: { src: string | null; compact?: boolean }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por el optimizador
    <img
      src={src}
      alt="Vista previa de tu foto"
      className={compact ? "h-40 w-full rounded-2xl object-cover" : "aspect-[4/3] w-full rounded-2xl object-cover"}
    />
  );
}
