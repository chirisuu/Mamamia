"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { MealOption, MealType } from "@/features/diary/types";
import { AiApiError, analyzeTextRequest } from "../lib/api-client";
import { textReviewItems } from "../lib/review";
import { MAX_TEXT_CHARS, type AiQuotaDto, type TextAnalysisResponse } from "../schemas";
import { AiErrorView } from "./ai-error-view";
import { QuotaLine } from "./ai-notices";
import { ReviewPanel } from "./review-panel";

export const TEXT_EXAMPLE = "Comí 150 g de pollo, una taza de arroz y una palta pequeña";

export type TextEntryProps = {
  mode: "text" | "voice";
  text: string;
  onTextChange: (text: string) => void;
  localDate: string;
  maxDate: string;
  defaultMeal: MealType;
  defaultCustomName: string | null;
  mealOptions: MealOption[];
  quota: AiQuotaDto;
  searchHref: string;
  /** Controles encima del texto (dictado o grabación en la pantalla de voz). */
  header?: React.ReactNode;
  /** Desactiva el texto mientras se dicta o transcribe. */
  busy?: boolean;
};

type Phase = "edit" | "analyzing" | "review" | "error";

/**
 * Texto (escrito o dictado) → candidatos estructurados con preguntas de aclaración →
 * revisión → confirmar. Fuente `text_ai` o `voice_ai` según el modo.
 */
export function TextEntry(props: TextEntryProps) {
  const { mode, text, onTextChange, quota: initialQuota, searchHref, header, busy } = props;
  const id = React.useId();
  const abortRef = React.useRef<AbortController | null>(null);
  const [phase, setPhase] = React.useState<Phase>("edit");
  const [result, setResult] = React.useState<TextAnalysisResponse | null>(null);
  const [error, setError] = React.useState<unknown>(null);
  const [quota, setQuota] = React.useState(initialQuota);
  const trimmed = text.trim();
  const unit = mode === "voice" ? "análisis de voz" : "análisis de texto";

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const analyze = async () => {
    if (trimmed.length < 3) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("analyzing");
    setError(null);
    try {
      const res = await analyzeTextRequest(trimmed, mode, controller.signal);
      setResult(res);
      setQuota(res.quota);
      setPhase("review");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setPhase("edit");
        return;
      }
      if (e instanceof AiApiError && e.quota) setQuota(e.quota);
      setError(e);
      setPhase("error");
    } finally {
      abortRef.current = null;
    }
  };

  const backToEdit = () => {
    setResult(null);
    setError(null);
    setPhase("edit");
  };

  if (phase === "review" && result) {
    return (
      <div className="grid gap-4">
        <div className="rounded-2xl bg-muted/60 p-4 text-sm">
          <p className="text-muted-foreground">{mode === "voice" ? "Dijiste:" : "Escribiste:"}</p>
          <p className="mt-1">«{trimmed}»</p>
          <Button variant="link" className="mt-1 h-auto min-h-11 p-0" onClick={backToEdit}>
            Corregir el texto
          </Button>
        </div>
        {result.candidates.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            No encontramos alimentos en el texto. Escribe qué comiste y cuánto, por ejemplo: «{TEXT_EXAMPLE}».
          </p>
        ) : null}
        <ReviewPanel
          requestId={result.requestId}
          source={mode === "voice" ? "voice_ai" : "text_ai"}
          initialItems={textReviewItems(result.candidates)}
          localDate={props.localDate}
          maxDate={props.maxDate}
          defaultMeal={props.defaultMeal}
          defaultCustomName={props.defaultCustomName}
          mealOptions={props.mealOptions}
          onDiscard={() => {
            onTextChange("");
            backToEdit();
          }}
        />
        <QuotaLine used={quota.used} limit={quota.limit} unit={unit} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {header}
      <div className="grid gap-2">
        <Label htmlFor={`${id}-text`}>{mode === "voice" ? "Lo que dictaste (puedes corregirlo)" : "¿Qué comiste?"}</Label>
        <Textarea
          id={`${id}-text`}
          value={text}
          onChange={(e) => onTextChange(e.target.value.slice(0, MAX_TEXT_CHARS))}
          placeholder={TEXT_EXAMPLE}
          rows={4}
          maxLength={MAX_TEXT_CHARS}
          disabled={phase === "analyzing" || busy}
          aria-describedby={`${id}-help`}
        />
        <p id={`${id}-help`} className="flex justify-between gap-2 text-xs text-muted-foreground">
          <span>Incluye cantidades si las sabes: gramos, tazas, unidades…</span>
          <span className="tabular-nums">
            {text.length}/{MAX_TEXT_CHARS}
          </span>
        </p>
      </div>

      {phase === "analyzing" ? (
        <div aria-busy="true" aria-live="polite" className="grid gap-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="size-4 text-primary-strong" aria-hidden="true" />
            Entendiendo lo que comiste…
          </p>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Button variant="ghost" onClick={() => abortRef.current?.abort()}>
            <X aria-hidden="true" />
            Cancelar
          </Button>
        </div>
      ) : (
        <Button size="lg" onClick={analyze} disabled={trimmed.length < 3 || busy || quota.used >= quota.limit}>
          <Sparkles aria-hidden="true" />
          Entender y revisar
        </Button>
      )}

      {phase === "error" ? (
        <AiErrorView
          error={error}
          what={mode === "voice" ? "el texto de tu dictado" : "lo que escribes"}
          onRetry={analyze}
          alternativeHref={searchHref}
          alternativeLabel="Buscar por nombre"
        />
      ) : null}

      <p className="text-xs text-muted-foreground">
        El texto se envía a un proveedor de IA externo solo para identificar alimentos y cantidades; las calorías salen de nuestra base. Revisas
        todo antes de registrar.{" "}
        <Link href="/app/perfil/privacidad" className="font-medium text-primary-strong underline-offset-4 hover:underline">
          Privacidad
        </Link>
      </p>
      <QuotaLine used={quota.used} limit={quota.limit} unit={unit} />
    </div>
  );
}

/** Pantalla de texto: solo el área de texto. */
export function TextFlow(props: Omit<TextEntryProps, "mode" | "text" | "onTextChange" | "header" | "busy">) {
  const [text, setText] = React.useState("");
  return <TextEntry {...props} mode="text" text={text} onTextChange={setText} />;
}
