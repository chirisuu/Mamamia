"use client";

import * as React from "react";
import { Flashlight, FlashlightOff, Keyboard, RotateCcw, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { normalizeScannedBarcode } from "@/lib/foods/barcode";
import { CAMERA_CONSTRAINTS, CAMERA_PROBLEMS, classifyCameraError, pickNativeFormats, type CameraProblem } from "../lib/camera";

type DetectedBarcode = { rawValue: string };
type NativeDetector = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type NativeDetectorCtor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** BarcodeDetector nativo (Chrome/Android, Safari reciente) con los formatos de producto, o null. */
async function createNativeDetector(): Promise<NativeDetector | null> {
  const Ctor = (globalThis as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (!Ctor) return null;
  try {
    const formats = pickNativeFormats((await Ctor.getSupportedFormats?.()) ?? []);
    return formats.length ? new Ctor({ formats }) : null;
  } catch {
    return null;
  }
}

type ScannerControls = { stop: () => void };

export type BarcodeScannerProps = {
  /** Código válido (dígito verificador correcto) leído por la cámara. */
  onDetected: (code: string) => void;
  onClose: () => void;
  /** Lleva el foco a la entrada manual. */
  onManual: () => void;
};

/**
 * Vista de cámara que lee EAN-13/8 y UPC-A/E. Usa BarcodeDetector si el navegador lo trae; si no,
 * ZXing (BrowserMultiFormatReader, cargado bajo demanda). Al leer un código válido apaga la cámara.
 * Nada se graba ni se sube: los cuadros solo se analizan en el dispositivo.
 */
export function BarcodeScanner({ onDetected, onClose, onManual }: BarcodeScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const trackRef = React.useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = React.useRef(onDetected);
  const [attempt, setAttempt] = React.useState(0);
  const [status, setStatus] = React.useState<"starting" | "scanning" | "error">("starting");
  const [problem, setProblem] = React.useState<CameraProblem | null>(null);
  const [torch, setTorch] = React.useState({ available: false, on: false, busy: false });

  React.useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  React.useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let controls: ScannerControls | null = null;

    const stopAll = () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      controls?.stop();
      controls = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      trackRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const fail = (p: CameraProblem) => {
      if (cancelled) return;
      setProblem(p);
      setStatus("error");
    };

    const handle = (raw: string): boolean => {
      const code = normalizeScannedBarcode(raw);
      if (!code || cancelled) return false;
      navigator.vibrate?.(60);
      stopAll();
      onDetectedRef.current(code);
      return true;
    };

    (async () => {
      if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        fail("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
      } catch (error) {
        fail(classifyCameraError(error));
        return;
      }
      const video = videoRef.current;
      if (cancelled || !video) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // Algunos navegadores rechazan play() si el video aún no tiene datos; el lector reintenta.
      }
      const track = stream.getVideoTracks()[0] ?? null;
      trackRef.current = track;
      const caps = (track?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
      setTorch({ available: caps.torch === true, on: false, busy: false });

      const native = await createNativeDetector();
      if (cancelled) return;
      if (native) {
        setStatus("scanning");
        const loop = async () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2) {
              const found = await native.detect(video);
              for (const b of found) if (handle(b.rawValue)) return;
            }
          } catch {
            // Cuadro no disponible todavía: se intenta con el siguiente.
          }
          if (!cancelled) timer = window.setTimeout(loop, 180);
        };
        void loop();
        return;
      }

      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelled) return;
        const hints = new Map<(typeof DecodeHintType)[keyof typeof DecodeHintType], unknown>([
          [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
        ]);
        const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
        setStatus("scanning");
        const c = await reader.decodeFromVideoElement(video, (result) => {
          if (result) handle(result.getText());
        });
        if (cancelled) c.stop();
        else controls = c;
      } catch {
        fail("decoder");
      }
    })();

    return stopAll;
  }, [attempt]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track || torch.busy) return;
    const next = !torch.on;
    setTorch((t) => ({ ...t, busy: true }));
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ available: true, on: next, busy: false });
    } catch {
      // Si el dispositivo no deja encenderla, se oculta el botón en vez de dejarlo sin efecto.
      setTorch({ available: false, on: false, busy: false });
    }
  };

  const retry = () => {
    setProblem(null);
    setStatus("starting");
    setTorch({ available: false, on: false, busy: false });
    setAttempt((n) => n + 1);
  };

  if (status === "error" && problem) {
    const copy = CAMERA_PROBLEMS[problem];
    return (
      <div className="flex flex-col gap-3">
        <Alert variant={problem === "denied" || problem === "unknown" || problem === "decoder" ? "destructive" : "warning"}>
          <AlertTitle>{copy.title}</AlertTitle>
          <AlertDescription>
            <p>{copy.body}</p>
          </AlertDescription>
        </Alert>
        <div className="flex flex-wrap gap-2">
          {copy.canRetry ? (
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              <RotateCcw aria-hidden="true" />
              Reintentar
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onManual}>
            <Keyboard aria-hidden="true" />
            Escribir el código
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl bg-brand-carbon">
        <video
          ref={videoRef}
          className="absolute inset-0 size-full object-cover"
          muted
          playsInline
          autoPlay
          aria-label="Vista de la cámara para leer el código de barras"
        />
        {/* Guía de encuadre: rectángulo ancho, como un código de barras. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[38%] -translate-y-1/2 rounded-2xl border-2 border-primary/90 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" />
        <div className="absolute right-3 top-3 flex gap-2">
          {torch.available ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              className="rounded-full bg-card/90"
              onClick={toggleTorch}
              aria-pressed={torch.on}
              aria-label={torch.on ? "Apagar la linterna" : "Encender la linterna"}
              disabled={torch.busy}
            >
              {torch.on ? <FlashlightOff aria-hidden="true" /> : <Flashlight aria-hidden="true" />}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="icon-sm" className="rounded-full bg-card/90" onClick={onClose} aria-label="Cerrar la cámara">
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="text-center text-sm text-muted-foreground">
        {status === "starting" ? "Abriendo la cámara…" : "Centra el código de barras dentro del recuadro."}
      </p>
    </div>
  );
}
