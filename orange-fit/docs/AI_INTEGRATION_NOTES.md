# Notas verificadas de integración con Claude (SDK @anthropic-ai/sdk 0.133)

Fuente: referencia oficial del SDK (skill claude-api, cacheada 2026-10-06). No improvisar otra forma.

## Modelos y precios (USD por millón de tokens)
| Modelo | ID | Entrada | Salida |
|---|---|---|---|
| Claude Opus 5.5 (por defecto) | `claude-opus-5-5` | 4.00 | 20.00 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2.00 | 10.00 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0.10 | 0.50 (hasta 100K de prompt) |
Los IDs se usan tal cual, sin sufijos de fecha. Por defecto `claude-opus-5-5` (envs `AI_MODEL_VISION`,
`AI_MODEL_TEXT`, `AI_MODEL_CHAT`); el operador puede elegir otro modelo por costo.

## Reglas de API para Opus 5.5
- Thinking siempre activo: NO enviar `thinking: {type: "disabled"}` ni `budget_tokens` (400). Controlar con
  `output_config: { effort: "low" | "medium" | "high" }` (default `medium`). Sin `temperature`/`top_p`.
- `tool_choice` `any`/`tool` devuelve 400: para JSON usar **structured outputs**.
- Sin prefill del asistente.
- Revisar `stop_reason === "refusal"` antes de leer el contenido.
- Activar el reintento server-side por defecto: `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"`
  (solo en la API de Claude; no con Haiku 5.5 — ahí no enviar `fallbacks`).

## Salida estructurada (Zod) con la API beta (para poder usar `fallbacks`)
```ts
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

const client = new Anthropic({ apiKey: serverEnv().ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
const response = await client.beta.messages.parse({
  model,
  max_tokens: 16000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  output_config: { effort: "medium", format: betaZodOutputFormat(Schema) },
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
    { type: "text", text: "..." },
  ] }],
});
if (response.stop_reason === "refusal") { /* no registrar nada; error AI_REFUSED */ }
const parsed = response.parsed_output; // null si no validó → error, nunca inventar
response.usage.input_tokens; response.usage.output_tokens; // para costo estimado
```
Con Haiku 5.5 usar el mismo `parse` pero sin `betas` de fallback ni `fallbacks`.

## Chat con streaming
```ts
const stream = client.beta.messages.stream({
  model, max_tokens: 4000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
  output_config: { effort: "low" }, system, messages,
});
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") { /* enviar event.delta.text */ }
}
const final = await stream.finalMessage(); // usage y stop_reason
```
Devolver al cliente como `ReadableStream` de texto (Route Handler `export async function POST`), cortar si
`stop_reason === "refusal"` y guardar el mensaje completo solo al terminar.

## Errores (más específico primero)
`Anthropic.AuthenticationError` → `AI_NOT_CONFIGURED`/clave inválida (503);
`Anthropic.RateLimitError` → 429 con reintentar más tarde; `Anthropic.BadRequestError` → 400 interno (log sin
contenido del usuario); `Anthropic.APIError` → 502; `Anthropic.APIConnectionError` → 503. El SDK ya reintenta
408/409/429/5xx (maxRetries).
