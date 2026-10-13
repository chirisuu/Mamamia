"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, RotateCcw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isIsoDate } from "@/lib/dates";
import { compressImage, ImageCompressError, type CompressedImage } from "../lib/image-compress";
import { PHOTO_BUCKET, PHOTO_POSE_LABELS, PHOTO_POSES, type PhotoPose } from "../lib/photo-path";
import { preparePhotoUploadAction, savePhotoAction } from "../photo-actions";

type Step = "idle" | "compressing" | "ready" | "uploading";

/** Archivo original máximo que aceptamos leer (la foto final pesa mucho menos). */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/**
 * Subir una foto de progreso: cámara o galería → compresión en el navegador (máx. 1600 px, WebP)
 * → el servidor da la ruta → se sube con la sesión del navegador (RLS de Storage) → el servidor
 * guarda la fila. Nada se sube hasta que la persona toca «Guardar foto».
 */
export function PhotoUploader({ today }: { today: string }) {
  const router = useRouter();
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("idle");
  const [image, setImage] = React.useState<CompressedImage | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pose, setPose] = React.useState<PhotoPose>("front");
  const [date, setDate] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function reset() {
    setImage(null);
    setPreview(null);
    setNote("");
    setError(null);
    setStep("idle");
    if (cameraRef.current) cameraRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    if (file.size > MAX_INPUT_BYTES) {
      setError("Esa imagen es muy pesada. Prueba con otra foto.");
      return;
    }
    setStep("compressing");
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setPreview(URL.createObjectURL(compressed.blob));
      setStep("ready");
    } catch (err) {
      setError(err instanceof ImageCompressError ? err.message : "No pudimos preparar la foto. Prueba con otra.");
      setStep("idle");
    }
  }

  async function save() {
    if (!image) return;
    if (!isIsoDate(date) || date > today) {
      setError("Elige una fecha válida (hoy o antes).");
      return;
    }
    setError(null);
    setStep("uploading");
    try {
      const prepared = await preparePhotoUploadAction({ localDate: date, pose, ext: image.ext });
      if (!prepared.ok) {
        setError(prepared.error.message);
        setStep("ready");
        return;
      }
      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(prepared.data.path, image.blob, {
        contentType: image.contentType,
        upsert: false,
        cacheControl: "3600",
      });
      if (uploadError) {
        setError("No pudimos subir la foto. Revisa tu conexión e inténtalo de nuevo.");
        setStep("ready");
        return;
      }
      const saved = await savePhotoAction({ path: prepared.data.path, localDate: date, pose, note: note.trim() || null });
      if (!saved.ok) {
        setError(saved.error.message);
        setStep("ready");
        return;
      }
      toast.success("Foto guardada en tu espacio privado.");
      reset();
      router.refresh();
    } catch {
      setError("No pudimos guardar la foto. Inténtalo de nuevo.");
      setStep("ready");
    }
  }

  const busy = step === "compressing" || step === "uploading";

  return (
    <div className="grid gap-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
      <input ref={galleryRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />

      {step === "idle" || step === "compressing" ? (
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => cameraRef.current?.click()} loading={step === "compressing"} size="lg">
            <Camera aria-hidden="true" />
            Tomar foto
          </Button>
          <Button variant="outline" onClick={() => galleryRef.current?.click()} disabled={busy} size="lg">
            <ImagePlus aria-hidden="true" />
            Elegir de galería
          </Button>
        </div>
      ) : null}

      {preview && image ? (
        <div className="grid gap-4">
          <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-border bg-muted">
            {/* Vista previa local (blob:), aún no subida. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Vista previa de la foto elegida" className="aspect-[3/4] w-full object-cover" />
          </div>
          <p className="text-center text-xs text-muted-foreground" data-numeric="">
            Lista para subir: {image.width}×{image.height} px, {Math.max(1, Math.round(image.blob.size / 1024))} KB.
          </p>
          <div className="grid gap-1.5">
            <span id={`${id}-pose`} className="text-sm font-medium">
              Pose
            </span>
            <SegmentedControl
              aria-labelledby={`${id}-pose`}
              size="sm"
              value={pose}
              onValueChange={setPose}
              options={PHOTO_POSES.map((p) => ({ value: p, label: PHOTO_POSE_LABELS[p] }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-date`}>Fecha</Label>
              <Input id={`${id}-date`} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-note`}>Nota (opcional)</Label>
              <Input
                id={`${id}-note`}
                value={note}
                maxLength={500}
                placeholder="Con luz natural, en ayunas…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={reset} disabled={busy}>
              <RotateCcw aria-hidden="true" />
              Elegir otra
            </Button>
            <Button onClick={() => void save()} loading={step === "uploading"}>
              Guardar foto
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Consejo: usa la misma luz, distancia y ropa cada vez; así la comparación es más justa. Las fotos se guardan comprimidas
        (máx. 1600 px) y sin datos de ubicación.
      </p>
    </div>
  );
}
