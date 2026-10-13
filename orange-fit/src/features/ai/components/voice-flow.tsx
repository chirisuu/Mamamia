"use client";

import * as React from "react";
import Link from "next/link";
import { Mic, MicOff, Square } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AiApiError, transcribeRequest } from "../lib/api-client";
import { MAX_TEXT_CHARS } from "../schemas";
import { AiErrorView } from "./ai-error-view";
import { TextEntry, type TextEntryProps } from "./text-entry";

/* Tipos mínimos de la Web Speech API (no vienen en lib.dom de TypeScript). */
type SpeechAlternative = { transcript: string };
type SpeechResult = { isFinal: boolean; length: number; [index: number]: SpeechAlternative };
type SpeechEvent = { resultIndex: number; results: { length: number; [index: number]: SpeechResult } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

function recorderMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
}

const MAX_RECORD_SECONDS = 60;

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "No tenemos permiso para usar el micrófono. Actívalo en los ajustes del navegador o escribe lo que comiste.",
  "service-not-allowed": "Tu navegador no permite el dictado aquí. Escribe lo que comiste.",
  "no-speech": "No te escuchamos. Acércate al micrófono e inténtalo de nuevo.",
  "audio-capture": "No encontramos un micrófono disponible.",
  network: "El dictado de tu navegador necesita conexión a internet.",
  aborted: "",
};

type Capability = "detecting" | "speech" | "record" | "none";

type VoiceFlowProps = Omit<TextEntryProps, "mode" | "text" | "onTextChange" | "header" | "busy"> & {
  transcriptionConfigured: boolean;
  textHref: string;
};

/**
 * Registro por voz: dictado del navegador (Web Speech API, es-PE) si existe; si no, grabación con
 * MediaRecorder + /api/ai/transcribe cuando está configurado; si nada está disponible, se dice y
 * se ofrece escribir. Luego, el mismo flujo que el texto con fuente `voice_ai`.
 */
export function VoiceFlow({ transcriptionConfigured, textHref, ...rest }: VoiceFlowProps) {
  const [capability, setCapability] = React.useState<Capability>("detecting");
  const [text, setText] = React.useState("");

  React.useEffect(() => {
    // Se detecta en el cliente (en el servidor no existen estas APIs).
    const cap: Capability = getSpeechRecognition() ? "speech" : transcriptionConfigured && canRecord() ? "record" : "none";
    const t = setTimeout(() => setCapability(cap), 0);
    return () => clearTimeout(t);
  }, [transcriptionConfigured]);

  if (capability === "detecting") {
    return (
      <div aria-busy="true" className="grid gap-3">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  if (capability === "none") {
    return (
      <Alert variant="warning">
        <MicOff aria-hidden="true" />
        <AlertTitle>El dictado no está disponible aquí</AlertTitle>
        <AlertDescription>
          <p>
            Tu navegador no permite dictar y la transcripción de audio en el servidor
            {transcriptionConfigured ? " necesita un navegador que pueda grabar audio." : " está pendiente de configurar."} Puedes escribir lo que
            comiste y la IA lo entiende igual.
          </p>
          <Button asChild size="sm" className="mt-1">
            <Link href={textHref}>Escribir lo que comí</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const append = (chunk: string) => setText((prev) => `${prev.trim()} ${chunk.trim()}`.trim().slice(0, MAX_TEXT_CHARS));

  return (
    <VoiceInner
      {...rest}
      capability={capability}
      transcriptionConfigured={transcriptionConfigured}
      text={text}
      setText={setText}
      append={append}
    />
  );
}

function VoiceInner({
  capability,
  transcriptionConfigured,
  text,
  setText,
  append,
  ...rest
}: Omit<VoiceFlowProps, "textHref"> & {
  capability: "speech" | "record";
  text: string;
  setText: (t: string) => void;
  append: (t: string) => void;
}) {
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [speechError, setSpeechError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);

  const [recording, setRecording] = React.useState(false);
  const [seconds, setSeconds] = React.useState(0);
  const [transcribing, setTranscribing] = React.useState(false);
  const [recordError, setRecordError] = React.useState<unknown>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  React.useEffect(
    () => () => {
      recognitionRef.current?.abort();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      stopTracks();
      abortRef.current?.abort();
    },
    [],
  );

  const startDictation = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "es-PE";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) append(finalText);
      setInterim(interimText);
    };
    rec.onerror = (event) => {
      const msg = SPEECH_ERRORS[event.error] ?? "El dictado se interrumpió. Inténtalo de nuevo o escribe lo que comiste.";
      if (msg) setSpeechError(msg);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recognitionRef.current = rec;
    setSpeechError(null);
    try {
      rec.start();
      setListening(true);
    } catch {
      setSpeechError("No pudimos iniciar el dictado. Inténtalo de nuevo.");
    }
  };

  const stopDictation = () => recognitionRef.current?.stop();

  const startRecording = async () => {
    setRecordError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setRecordError(new AiApiError(0, "MIC_DENIED", "No tenemos permiso para usar el micrófono. Actívalo en los ajustes del navegador o escribe lo que comiste."));
      return;
    }
    streamRef.current = stream;
    const mimeType = recorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      stopTracks();
      setRecording(false);
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) return;
      const controller = new AbortController();
      abortRef.current = controller;
      setTranscribing(true);
      try {
        const res = await transcribeRequest(blob, controller.signal);
        append(res.text);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setRecordError(e);
      } finally {
        setTranscribing(false);
        abortRef.current = null;
      }
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stopRecording = React.useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") recorderRef.current.stop();
  }, []);

  // Tope de duración: se detiene sola al llegar al máximo.
  React.useEffect(() => {
    if (recording && seconds >= MAX_RECORD_SECONDS) stopRecording();
  }, [recording, seconds, stopRecording]);

  const header =
    capability === "speech" ? (
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        <Button size="lg" variant={listening ? "secondary" : "default"} onClick={listening ? stopDictation : startDictation}>
          {listening ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
          {listening ? "Terminar dictado" : text ? "Seguir dictando" : "Dictar lo que comí"}
        </Button>
        <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
          {listening ? (interim ? `«${interim}»` : "Escuchando… habla con naturalidad.") : ""}
        </p>
        {speechError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {speechError}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          El dictado lo hace tu navegador (es-PE): según el navegador, el audio se procesa en tu equipo o en el servicio de voz de su fabricante.
          Nosotros solo recibimos el texto, que puedes corregir antes de enviarlo.
        </p>
      </div>
    ) : (
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4">
        {transcribing ? (
          <div aria-busy="true" aria-live="polite" className="grid gap-2">
            <p className="text-sm font-medium">Transcribiendo tu audio…</p>
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : (
          <Button size="lg" variant={recording ? "secondary" : "default"} onClick={recording ? stopRecording : startRecording}>
            {recording ? <Square aria-hidden="true" /> : <Mic aria-hidden="true" />}
            {recording ? `Detener (${MAX_RECORD_SECONDS - seconds} s)` : "Grabar lo que comí"}
          </Button>
        )}
        <p aria-live="polite" className="sr-only">
          {recording ? "Grabando" : ""}
        </p>
        {recordError ? (
          recordError instanceof AiApiError && recordError.code === "MIC_DENIED" ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {recordError.message}
            </p>
          ) : (
            <AiErrorView error={recordError} what="el audio de tu dictado" alternativeHref={rest.searchHref} alternativeLabel="Buscar por nombre" />
          )
        ) : null}
        <p className="text-xs text-muted-foreground">
          Tu navegador no tiene dictado, así que grabamos hasta {MAX_RECORD_SECONDS} segundos y el audio se transcribe con un proveedor externo
          {transcriptionConfigured ? "" : " (pendiente de configurar)"}. El audio no se guarda.
        </p>
      </div>
    );

  return <TextEntry {...rest} mode="voice" text={text} onTextChange={setText} header={header} busy={listening || recording || transcribing} />;
}
