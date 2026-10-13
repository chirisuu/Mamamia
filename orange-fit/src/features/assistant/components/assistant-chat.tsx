"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, History, MessageSquarePlus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { AiErrorView } from "@/features/ai/components/ai-error-view";
import { AiApiError } from "@/features/ai/lib/api-client";
import type { AiQuotaDto } from "@/features/ai/schemas";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deleteConversationAction } from "../actions";
import { streamChat } from "../lib/chat-client";
import { MAX_CHAT_MESSAGE_CHARS, type AssistantMessageDto, type ConversationSummary } from "../schemas";

const STARTERS = [
  "¿Cómo puedo llegar a mi meta de proteína hoy?",
  "Ideas de desayuno con más fibra y fácil de preparar",
  "¿Qué combino con el arroz para un almuerzo más balanceado?",
  "¿Cómo leo la etiqueta nutricional de un producto?",
];

type ChatMessage = AssistantMessageDto & { pending?: boolean };

export type AssistantChatProps = {
  conversationId: string | null;
  initialMessages: AssistantMessageDto[];
  conversations: ConversationSummary[];
  quota: AiQuotaDto;
  /** Si es false, solo se puede leer el historial (con el motivo visible arriba). */
  canSend: boolean;
};

/**
 * Chat del asistente con respuesta en streaming. El texto que llega es provisional hasta el evento
 * "done" (ya guardado); si llega un error o una negativa, se descarta y no queda en el historial.
 */
export function AssistantChat({ conversationId: initialConversationId, initialMessages, conversations, quota: initialQuota, canSend }: AssistantChatProps) {
  const router = useRouter();
  const inputId = React.useId();
  const [conversationId, setConversationId] = React.useState(initialConversationId);
  const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [quota, setQuota] = React.useState(initialQuota);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const left = Math.max(0, quota.limit - quota.used);
  const disabled = !canSend || streaming || left <= 0;

  React.useEffect(() => () => abortRef.current?.abort(), []);
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || disabled) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const tempUserId = `tmp-u-${Date.now()}`;
    const tempAssistantId = `tmp-a-${Date.now()}`;
    const now = new Date().toISOString();
    setError(null);
    setDraft("");
    setStreaming(true);
    setStatus("El asistente está respondiendo…");
    setMessages((list) => [
      ...list,
      { id: tempUserId, role: "user", content: message, flagged: false, createdAt: now, pending: true },
      { id: tempAssistantId, role: "assistant", content: "", flagged: false, createdAt: now, pending: true },
    ]);
    const dropProvisional = () => setMessages((list) => list.filter((m) => m.id !== tempUserId && m.id !== tempAssistantId));
    let finished = false;
    try {
      await streamChat(
        { conversationId, message },
        (event) => {
          if (event.type === "meta") {
            if (!conversationId) {
              setConversationId(event.conversationId);
              window.history.replaceState(null, "", `/app/asistente?c=${event.conversationId}`);
            }
          } else if (event.type === "delta") {
            setMessages((list) => list.map((m) => (m.id === tempAssistantId ? { ...m, content: m.content + event.text } : m)));
          } else if (event.type === "done") {
            finished = true;
            setMessages((list) =>
              list.map((m) =>
                m.id === tempAssistantId
                  ? { ...m, id: event.messageId, pending: false }
                  : m.id === tempUserId
                    ? { ...m, id: event.userMessageId, pending: false, flagged: event.flagged }
                    : m,
              ),
            );
            if (event.quota) setQuota(event.quota);
            setStatus("Respuesta lista.");
          } else if (event.type === "error") {
            finished = true;
            dropProvisional();
            setDraft(message);
            setError(new AiApiError(0, event.code, event.message));
            setStatus("");
          }
        },
        controller.signal,
      );
      router.refresh();
    } catch (e) {
      if (!finished) {
        dropProvisional();
        setDraft(message);
      }
      if (e instanceof DOMException && e.name === "AbortError") {
        setStatus("Se detuvo la respuesta. No se guardó.");
      } else {
        if (e instanceof AiApiError && e.quota) setQuota(e.quota);
        setError(e);
        setStatus("");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const remove = async (id: string) => {
    const res = await deleteConversationAction({ conversationId: id });
    if (!res.ok) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Conversación borrada");
    if (id === conversationId) {
      router.push("/app/asistente");
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History aria-hidden="true" />
          Conversaciones
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/asistente">
            <MessageSquarePlus aria-hidden="true" />
            Nueva
          </Link>
        </Button>
      </div>

      <section aria-label="Mensajes" className="flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="grid gap-3 rounded-2xl border border-dashed border-border p-5">
            <p className="font-semibold">¿En qué te ayudo hoy?</p>
            <p className="text-sm text-muted-foreground">
              Puedo explicarte tus metas, darte ideas de comidas con alimentos de aquí y resolver dudas de nutrición general. Uso solo tu meta, tu
              objetivo y lo que registraste hoy.
            </p>
            <ul className="grid gap-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setDraft(s)}
                    className="min-h-11 w-full rounded-xl border border-border bg-card px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="flex flex-col gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
                    m.role === "user" ? "rounded-br-md bg-accent text-accent-foreground" : "rounded-bl-md border border-border bg-card",
                  )}
                >
                  <span className="sr-only">{m.role === "user" ? "Tú: " : "Asistente: "}</span>
                  {m.content || (m.pending ? <span className="text-muted-foreground">Escribiendo…</span> : null)}
                  {m.role === "assistant" && m.pending && m.content ? (
                    <span className="mt-1 block text-xs text-muted-foreground">Respuesta en curso (aún no guardada)</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {error ? (
        <AiErrorView
          error={error}
          what="tus mensajes al asistente"
          onRetry={() => {
            setError(null);
            void send(draft);
          }}
          alternativeHref="/app"
          alternativeLabel="Volver al inicio"
        />
      ) : null}

      <form
        className="grid gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Escribe tu pregunta
        </label>
        <div className="flex items-end gap-2">
          <Textarea
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHAT_MESSAGE_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(draft);
              }
            }}
            rows={2}
            maxLength={MAX_CHAT_MESSAGE_CHARS}
            placeholder={canSend ? "Pregunta sobre nutrición o tus metas…" : "No disponible por ahora"}
            disabled={!canSend || left <= 0}
            className="min-h-12 flex-1 resize-none"
          />
          {streaming ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Detener respuesta">
              <Square aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={disabled || !draft.trim()} aria-label="Enviar">
              <ArrowUp aria-hidden="true" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {left > 0
            ? `Te quedan ${formatNumber(left)} de ${formatNumber(quota.limit)} mensajes este mes.`
            : "Usaste todos tus mensajes de este mes."}{" "}
          No reemplaza a un profesional de salud.
        </p>
      </form>
      <div ref={endRef} />

      <BottomSheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>Conversaciones</BottomSheetTitle>
            <BottomSheetDescription>Solo tú las ves. Puedes borrarlas cuando quieras.</BottomSheetDescription>
          </BottomSheetHeader>
          <div className="px-5 pb-4">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no tienes conversaciones guardadas.</p>
            ) : (
              <ul className="grid gap-2">
                {conversations.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <Link
                      href={`/app/asistente?c=${c.id}`}
                      onClick={() => setHistoryOpen(false)}
                      aria-current={c.id === conversationId ? "page" : undefined}
                      className={cn(
                        "flex min-h-12 min-w-0 flex-1 items-center rounded-xl border px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        c.id === conversationId ? "border-primary bg-accent font-semibold" : "border-border hover:bg-accent",
                      )}
                    >
                      <span className="truncate">{c.title}</span>
                    </Link>
                    <Button variant="ghost" size="icon-sm" aria-label={`Borrar «${c.title}»`} onClick={() => void remove(c.id)}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
