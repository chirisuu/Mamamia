# Módulo IA — registro por foto, voz y texto; asistente

Dueño de: `/app/agregar/{foto,voz,texto}`, `/app/asistente`, `/api/ai/*`. Código en `src/lib/ai/`
(proveedor, cupo, imagen, transcripción, precios), `src/features/ai/` (registro con IA) y
`src/features/assistant/` (chat). Integración con Claude según `docs/AI_INTEGRATION_NOTES.md`
(SDK `@anthropic-ai/sdk` 0.133).

Regla de fondo: **la IA solo propone qué alimento y cuánto**. Los nutrientes salen siempre de la tabla
`foods` (vía `addItemsToMeal`) y **nada se registra sin que la persona confirme**.

## Qué quedó funcional

### Proveedor (`src/lib/ai`)
- `provider.ts`: interfaz `NutritionAI` (`identifyFoodsFromPhoto`, `parseFoodText`, `chatStream`). Las
  rutas dependen de la interfaz, no del SDK.
- `anthropic.ts`: `client.beta.messages.parse` + `betaZodOutputFormat` (foto: effort `medium`; texto:
  `low`), `client.beta.messages.stream` para el chat (effort `low`, `max_tokens` 8000), reintento
  server-side `betas: ["server-side-fallback-2026-07-01"]` + `fallbacks: "default"` (no se envía con
  modelos Haiku), sin `thinking`, `temperature` ni `tool_choice`. Se revisa `stop_reason`: `refusal` →
  `AI_REFUSED`; `max_tokens` o `parsed_output` nulo → `AI_INVALID_OUTPUT`. En el chat, una negativa a
  mitad de la respuesta descarta todo lo parcial. Errores tipados del SDK → `AiError`
  (Authentication/PermissionDenied → `AI_NOT_CONFIGURED` 503, RateLimit → `AI_RATE_LIMITED` 429,
  BadRequest/APIError → `AI_PROVIDER_ERROR` 502, APIConnection → `AI_UNAVAILABLE` 503, abortado →
  `AI_ABORTED`). Logs sin contenido de la persona.
- `schemas.ts` (Zod de la salida del modelo, sin ningún campo de nutrientes), `normalize.ts` (rangos
  ordenados min ≤ best ≤ max en 1–5000 g, textos recortados, «sin cantidad» → pregunta), `prompts.ts`
  (español de Perú; prohíben calorías/nutrientes, piden incertidumbre honesta, sin diagnósticos, ignoran
  instrucciones dentro de la foto o el texto; prompt del asistente con límites y recursos de Perú).
- `pricing.ts`: USD por millón de tokens de la tabla oficial (Opus 5.5 4/20, Sonnet 5.5 2/10, Haiku 5.5
  0.10/0.50, y los modelos de respaldo Opus 5 / Opus 4.8 / Sonnet 5 a 5/25, 5/25, 2/10). Lectura de caché
  con el precio de cada modelo (Opus 5.5: 0.20), escritura ×1.25. Si la respuesta trae
  `usage.iterations` (hubo respaldo), cada intento se cobra con su modelo (el intento sin modelo, con el
  pedido). Modelo sin precio conocido → costo `null` (no se inventa).
- `errors.ts`: códigos y status (`AI_NOT_CONFIGURED` 503, `AI_QUOTA_EXCEEDED` 429, `AI_REFUSED` 422,
  `AI_INVALID_OUTPUT` 502, `AI_PROVIDER_ERROR` 502, `AI_RATE_LIMITED` 429, más `AI_UNAVAILABLE`,
  `AI_ABORTED`, `AI_REQUEST_CLOSED` 409, `AI_QUOTA_ERROR` 500).
- `quota.ts`: flujo obligatorio `consume_ai_quota(kind)` → proveedor → `complete_ai_request(...)`
  (`runWithAiQuota`). Si falla el proveedor, la solicitud queda `failed` con el código y los tokens ya
  gastados (no cuenta en el cupo). **Si `complete_ai_request` devuelve false, el resultado no se entrega**
  (`AI_REQUEST_CLOSED`).
- `matching.ts`: hasta 3 coincidencias por candidato con `searchFoods` (de lo específico a lo general:
  «pechuga de pollo a la plancha» → «pechuga de pollo» → «pechuga»), con sus porciones.
- `image.ts`: valida tamaño (≤ 8 MB) y tipo declarado, comprueba el formato real con sharp, corrige la
  orientación, reduce a ≤ 1568 px y re-codifica a JPEG sin metadatos (se descartan EXIF/GPS).
- `transcription.ts`: adaptador opcional OpenAI `POST /v1/audio/transcriptions` por `fetch` (multipart,
  `language=es`, modelo `whisper-1` o `OPENAI_TRANSCRIPTION_MODEL`). El audio no se guarda.
- `config.ts`: `aiConfig()` y `getNutritionAI()` (null sin clave: nunca se simula una respuesta).

### Rutas (`src/app/api/ai`)
Todas devuelven `{ error: { code, message } }` con `Cache-Control: private, no-store`. Guarda común
(`features/ai/server/http.ts`): sesión (401) → función Premium (403 `PREMIUM_REQUIRED`) → consentimiento
`ai_processing` **vigente** con `latestConsents`/`isConsentActive` (manda la última fila; una revocación
cuenta) (403 `CONSENT_REQUIRED`) → proveedor configurado (503). Límite por minuto con `check_rate_limit`
(foto 6, texto/voz 12, chat 20) aparte del cupo mensual.

| Ruta | Qué hace |
|---|---|
| `POST /api/ai/photo` | multipart `image` (JPG/PNG/WebP ≤ 8 MB) + `savePhoto`. Función `ai_photo`, cupo `photo`. Re-codifica con sharp; solo si `savePhoto=true` sube a `meal-photos/{uid}/{fecha local}/{requestId}.jpg` (y guarda la ruta en la solicitud); si el análisis falla la borra. Responde candidatos `{ nameEs, preparation, estimatedGrams{min,best,max}, confidence, visibleEvidence, matches[≤3] }`, `uncertaintyNote`, `isFoodImage`, `photoSaved`, `quota`. |
| `POST /api/ai/text` | `{ text ≤ 1000, mode: "text" \| "voice" }`. `mode: "voice"` exige `ai_voice` y usa el cupo de voz. Candidatos `{ foodQuery, quantity, unit, gramsIfStated, needsClarification, clarificationQuestion, matches[≤3] }`. |
| `POST /api/ai/transcribe` | multipart `audio` ≤ 8 MB (webm/ogg/mp4/mpeg/wav/aac). Solo con `TRANSCRIPTION_PROVIDER=openai` + `OPENAI_API_KEY`; si no, 503 `TRANSCRIPTION_NOT_CONFIGURED`. Usa cupo de voz; en la solicitud solo queda el largo del texto. |
| `POST /api/ai/chat` | `{ conversationId?, message ≤ 2000 }` → NDJSON en streaming (`meta`, `delta`, `done`, `error`; `features/assistant/lib/stream-protocol.ts`). |
| `GET /api/ai/status` | `{ configured, transcriptionConfigured, consent, plan, kinds: {photo,text,voice,chat: {included, used, limit}}, periodStart }`. No consume cupo. |

Ninguna ruta escribe en el diario. En `ai_analysis_requests.output` se guarda lo que propuso la IA y los
ids de las coincidencias (nunca nutrientes); en el chat solo referencias (conversación, mensaje, largo).

### Confirmación (`features/ai/actions.ts`)
`confirmAiItemsAction`: `requireUser` → Zod → la solicitud debe ser propia, `succeeded`, del tipo de la
fuente (`photo_ai`↔photo, `text_ai`↔text, `voice_ai`↔voice) y no registrada antes (`ALREADY_LOGGED`);
fecha hasta mañana en la zona del perfil → `addItemsToMeal` (nutrientes desde la base) con `source`,
`aiRequestId`; en foto, los ítems propuestos por la IA van con `isEstimate: true` y su `confidence`; los
agregados a mano desde la búsqueda no son estimación. `grantAiConsentAction` agrega la fila de
consentimiento (`CONSENT_VERSION`) desde las pantallas de IA; se retira en Privacidad.

### Pantallas
- **`/app/agregar/foto`**: tomar (cámara trasera) o subir; vista previa; opción «Guardar la foto en mi
  historial privado» (desmarcada por defecto); reducción en el navegador si pesa > 2.5 MB; análisis con
  esqueleto y «Cancelar»; «No vemos comida» si `isFoodImage=false`; revisión editable.
- **Revisión** (`review-panel.tsx` + `review-item-card.tsx`, compartida por foto/texto/voz): por ítem,
  alimento de la base entre las coincidencias (o «Buscar otro» en una hoja con `GET /api/foods/search`, o
  «Crear alimento» en otra pestaña), confianza visible (alta/media/baja + %), evidencia, rango estimado,
  deslizador dentro de min–max + gramos exactos (foto) o medida/cantidad con las porciones de la base
  (`AmountFields` del diario), vista previa con `NutrientPreview` del diario calculada con los valores
  por 100 g de la base, quitar/añadir ítems, comida y fecha. «Sin dato verificado» si no hay
  coincidencia. «Registrar en …» es lo único que escribe; luego va al diario del día.
- **`/app/agregar/texto`**: textarea con el ejemplo «Comí 150 g de pollo, una taza de arroz y una palta
  pequeña», contador, preguntas de aclaración por ítem; conversión unidad→gramos solo con porciones o
  densidad de la base (`lib/resolve-amount.ts`, sobre `src/lib/nutrition/units.ts`): si no se puede, pide
  los gramos (nunca asume un peso ni 1 g/ml).
- **`/app/agregar/voz`**: dictado del navegador (Web Speech API, `es-PE`) explicando que el audio lo
  procesa el navegador; si no existe, grabación con MediaRecorder (≤ 60 s) + `/api/ai/transcribe` cuando
  está configurado; si el dictado falla por el servicio del navegador, botón «Grabar audio en su lugar»;
  si nada está disponible, lo dice y lleva a «Escribir lo que comí». Luego el mismo flujo que texto con
  fuente `voice_ai`. El texto dictado se puede corregir antes de enviarlo.
- **`/app/asistente`**: chat con streaming (el texto es provisional hasta `done`; ante error o negativa se
  descarta y el mensaje vuelve al cuadro de texto), historial en `assistant_conversations/messages`
  (lista, abrir, borrar, nueva), aviso «No es consejo médico» con 106 y Línea 113 opción 5, cupo del mes,
  sugerencias de inicio, detener respuesta. Sin Premium, quien tuvo conversaciones las sigue pudiendo
  leer y borrar (solo lectura); sin historial ve solo la invitación a Premium.
- Estados honestos en todas: «IA pendiente de configurar», «Sin cupo este mes» (con fecha de
  renovación), «Premium» (`PremiumGate`), «Necesitamos tu permiso» (otorgable ahí mismo), errores con
  reintento y alternativa real (buscar por nombre). `loading.tsx` con `Skeleton` y `error.tsx` con
  `retry` en las cuatro rutas.

### Asistente: contexto y seguridad
- Contexto **mínimo** (`features/assistant/lib/context.ts`): fecha local, objetivo declarado, meta vigente
  (kcal, macros, fibra, agua), totales de hoy y cupo. Nunca fotos, nombre, correo, peso ni datos de
  terceros. Historial: últimos 20 mensajes de la conversación.
- Cribado de `src/lib/nutrition/risk.ts` (edad, IMC del último pesaje y estatura, banderas declaradas):
  si bloquea déficit o ayuno, el modelo recibe solo la regla («no propongas déficit», «no propongas
  ayunos»), no el motivo. `requires_professional_review` → no proponer cambios de meta.
- **Modo cuidado** (antecedente de TCA o conversación ya marcada): sin cifras de calorías ni restricción,
  foco en regularidad y bienestar, sugiere acompañamiento y Línea 113.
- **Moderación previa por reglas** (`lib/moderation.ts`, sin IA): autolesión, señales de TCA (vómito
  provocado, laxantes para bajar, dejar de comer, castigarse sin comer, atracones, miedo a comer) y
  restricción extrema (< 800 kcal al día, ayunos de días) → respuesta segura fija con recursos de Perú
  (Línea 113 opción 5 del MINSA, 106 SAMU), mensaje `flagged`, **sin llamar al modelo ni consumir
  cupo**. Las reglas evitan falsos positivos comunes («dejar de comer pan», «me mato entrenando», «una
  cena de 300 kcal», «no quiero hacerme daño en la rodilla»).

## Decisiones
- **Sin `ANTHROPIC_API_KEY` no se consume cupo**: la guarda responde 503 `AI_NOT_CONFIGURED` antes de
  `consume_ai_quota`, así que no se crea ninguna solicitud (tampoco `not_configured`). Motivo: no hay
  nada que medir y la persona no pierde cupo; el estado se ve en `/api/ai/status` y en la UI.
- Clave rechazada por el proveedor (401/403) → 503 `AI_NOT_CONFIGURED` con mensaje propio; la solicitud
  queda `failed` (no cuenta).
- El chat moderado no consume cupo. Los mensajes de chat se guardan **al final** (pregunta + respuesta
  juntas); si el cierre de la solicitud no se confirma se borran y el cliente recibe `error`. Una
  conversación nueva cuyo primer intento falla se borra.
- **Voz con grabación en el servidor usa 2 del cupo de voz** (transcripción + interpretación); la UI lo
  dice. Con el dictado del navegador usa 1.
- Cupo mostrado: el mes se cuenta en la zona del perfil (`lib/period.ts`, igual que la función SQL).
- La foto se sube antes de llamar a la IA (para guardar la ruta en la misma solicitud) y se borra si el
  análisis falla o no se entrega.
- Para elegir alimento y cantidad se reutilizan `AmountFields`, `NutrientPreview`, `buildAmountOptions`
  y la API de búsqueda del diario/alimentos; `PortionPicker` no encaja (registra un solo alimento al
  instante) y la búsqueda del diario es una página completa, así que la hoja de búsqueda es propia.

## Requiere credenciales
- **`ANTHROPIC_API_KEY`** (servidor). Modelos opcionales `AI_MODEL_VISION`, `AI_MODEL_TEXT`,
  `AI_MODEL_CHAT` (por defecto `claude-opus-5-5`; con un modelo Haiku no se envían `fallbacks`).
  **No hay clave en este entorno: no se hizo ninguna llamada real**; todo lo del proveedor se probó con
  el SDK simulado.
- Transcripción opcional: `TRANSCRIPTION_PROVIDER=openai` + `OPENAI_API_KEY` (y opcional
  `OPENAI_TRANSCRIPTION_MODEL`). Sin ellas, la voz funciona con el dictado del navegador o se ofrece
  escribir.
- Storage `meal-photos` (ya creado por las migraciones) para guardar fotos.

## Qué falta / límites conocidos
- No hay lista de «mis fotos de comidas» para ver o borrar las fotos guardadas (quedan en
  `meal-photos/{uid}/…`, se borran con la cuenta y vía exportación aparecen como URL firmadas).
- El costo de la transcripción no se estima (`estimated_cost_usd` null): el precio es por minuto.
- La moderación por reglas es simple (lista de expresiones); no reemplaza una revisión clínica.
- E2E: `tests/e2e/integraciones.spec.ts` comprueba el 503 `AI_NOT_CONFIGURED` sin clave; el flujo con IA
  real (foto → confirmación → registro) no se probó contra Anthropic.

## Pruebas
- Unitarias (`npx vitest run src/lib/ai src/features/ai src/features/assistant`, 104 pruebas):
  `anthropic.test.ts` (SDK simulado: éxito con `parsed_output`, negativa, `parsed_output` nulo,
  `max_tokens`, error de esquema, autenticación, límite, parámetros verificados, Haiku sin fallbacks,
  respaldo con su precio, chat en streaming y negativa a mitad), `pricing`, `quota`, `normalize`,
  `matching`, `image` (sharp real), `transcription` (`fetch` simulado), `features/ai/lib/*`
  (`resolve-amount`, `review`, `period`), `server/analyze.test.ts` (flujo de cupo; nunca toca el diario;
  foto borrada si falla), `server/http.test.ts` (códigos y status), `components/review-panel.test.tsx`
  (jsdom: nada se registra hasta «Registrar», solo los ítems marcados), `assistant/lib/*` (moderación con
  falsos positivos, contexto y bloqueos de riesgo, protocolo NDJSON) y `assistant/server/chat.test.ts`.
- Integración (`npx vitest run --config vitest.integration.config.ts tests/integration/ia.test.ts`, 13
  pruebas, Supabase local, SDK simulado): 401 sin sesión, 403 `PREMIUM_REQUIRED`, 403
  `CONSENT_REQUIRED` (sin consentimiento y con consentimiento retirado), 503 sin clave sin consumir cupo,
  503 de transcripción, estado, 429 sin cupo real (con el rechazo registrado), texto → confirmación →
  `meal_log_items` con nutrientes de la base y sin doble registro, negativa → `failed` y no confirmable,
  foto guardada solo si se elige y confirmada como estimación con confianza, chat moderado sin modelo ni
  cupo, chat en streaming guardado con costo, negativa a mitad → nada guardado.
