# ORANGE FIT — Registro de funciones

Qué hace hoy la app, qué necesita para funcionar y qué falta, verificado contra el código al **2026-10-14**.

## Leyenda

- ✅ **Funciona sin configurar nada** (solo Supabase: `NEXT_PUBLIC_SUPABASE_URL` + clave pública).
- 🔑 **Requiere credencial externa**: se indica la variable y qué pasa sin ella (503 o «pendiente de
  configurar»). Incluye `SUPABASE_SERVICE_ROLE_KEY`, la clave de servicio de Supabase, que no viene con la
  URL ni con la clave pública.
- 🚧 **Pendiente o parcial.**

Dos aclaraciones que aplican a todas las tablas:

- **(Premium)** = la función existe y funciona solo con Supabase, pero exige una suscripción `trialing` o
  `active` (`is_premium()`). Sin claves de Stripe o Mercado Pago nadie puede comprarla: la única forma de
  tener Premium es insertar la suscripción a mano en la base (así lo hacen las pruebas).
- Sin Supabase configurado, las pantallas muestran `SetupRequired` y las API responden 503.

## Cuenta y acceso

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Registro con nombre, correo, contraseña (8–72) y casilla de términos y privacidad | ✅ | `/registro`, `src/features/auth` | E2E `registro-onboarding.spec.ts`; integración `auth-signup.test.ts` |
| Verificación por correo (enlace con `token_hash`, sirve en otro navegador) y reenvío con espera de 60 s | ✅ en local (Mailpit). En producción hace falta SMTP en Supabase Auth | `/verificar`, `GET /auth/confirm`, `supabase/templates/` | E2E de registro con correo real en Mailpit; `auth-signup.test.ts` |
| Ingreso con correo y contraseña, `?next=` saneado, errores en español | ✅ | `/ingresar` | unitarias `auth.test.ts`, `auth-forms.test.tsx`; E2E `seguridad.spec.ts` |
| Recuperar y cambiar la contraseña | ✅ (mismo requisito de SMTP en producción) | `/recuperar`, `/nueva-clave` | `auth-signup.test.ts` (recuperación con PKCE) |
| Cerrar sesión (solo este dispositivo) | ✅ | `POST /auth/salir` | Sin prueba dedicada |
| Rutas protegidas: sin sesión, `/app` y `/admin` mandan a `/ingresar?next=` | ✅ | `src/proxy.ts`, `src/lib/supabase/proxy.ts`, `src/lib/auth/session.ts` | E2E `seguridad.spec.ts` |
| Ingreso con Google | 🔑 `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` + proveedor Google activo en Supabase. Sin eso el botón no aparece | `/auth/callback`, `src/features/auth/components/google-button.tsx` | Solo unitaria de visibilidad del botón; nunca contra Google |
| Cambio de correo, MFA, «cerrar sesión en todos los dispositivos» | 🚧 No existen | — | — |

## Onboarding y metas

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Asistente de 21 pantallas sin cuenta, con borrador en el dispositivo (`localStorage`) | ✅ | `/onboarding`, `src/features/onboarding/steps.ts` | unitaria `wizard.test.tsx` (recorre las 21); E2E de registro |
| Cálculo de metas (Mifflin-St Jeor, factor de actividad, ajuste con topes, pisos de 1200/1500 kcal, macros, fibra, agua) con «Cómo lo calculamos» | ✅ | `src/lib/nutrition/*`, `src/features/onboarding/plan.ts` | unitarias `src/lib/nutrition/*.test.ts`; integración `auth-onboarding.test.ts` |
| Cribado de riesgo: < 13 años no continúa; 13–17 años, embarazo, lactancia, IMC bajo, TCA, etc. → sin déficit ni ayuno, metas en mantenimiento y revisión profesional sugerida | ✅ | `src/lib/nutrition/risk.ts` | `risk.test.ts`; `auth-onboarding.test.ts` (menor de edad) |
| Guardado automático del plan al confirmar el correo (borrador de 7 días como máximo) | ✅ | `completeOnboarding`, `src/features/onboarding/components/draft-storage.ts` | E2E de registro (onboarding → correo → `/app` con la meta guardada) |
| Rehacer el cuestionario | ✅ | `/onboarding?rehacer=1` | `auth-onboarding.test.ts` |
| Datos del perfil (nacimiento, sexo para el cálculo, estatura, país, moneda, zona horaria, sumar ejercicio) | ✅ | `/app/perfil/datos` | Recorrido de humo |
| Metas: vigente con su origen, recalcular con el último peso, ajuste manual con bloqueos y avisos, historial | ✅ | `/app/perfil/metas` | unitaria `manual-targets.test.ts` |
| Meta fijada por un profesional, con aviso en la app a la persona | ✅ | `/app/perfil/profesional/pacientes/[userId]` | `auth-professional.test.ts`, `professional-access.test.ts` |
| Nombre del profesional que fijó la meta | 🔑 `SUPABASE_SERVICE_ROLE_KEY`. Sin ella se muestra «tu profesional» | `/app/perfil/metas` | — |
| «Ajustes» manuales del presupuesto del día | 🚧 Siempre 0 («Sin ajustes para hoy»): no existe tabla | `src/features/dashboard/queries.ts` | — |

## Diario

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Inicio: anillo calórico con desglose (base, ejercicio, ajustes, consumido, restante), macros, fibra, agua, peso con tendencia, rachas, accesos rápidos | ✅ | `/app` (`src/app/app/(inicio)/page.tsx`) | integración `diario-dashboard.test.ts`; `dashboard-cards.test.tsx`; captura real `public/screenshots/inicio.png` |
| Recordatorios calculados en Inicio (comida pasada sin registro, agua < 50 %, pesaje, meta faltante) y hasta 3 sugerencias por reglas, sin IA | ✅ | `src/features/dashboard/lib/{reminders,recommendations}.ts` | unitarias |
| Gráfico semanal: consumido vs meta; los días sin registro no se dibujan como 0 | ✅ | `src/features/dashboard/lib/series.ts` | `series.test.ts` |
| Diario por fecha: desayuno, almuerzo, cena, snacks y comidas personalizadas; navegación entre días (hasta mañana) | ✅ | `/app/diario`, `/app/diario/[fecha]` | integración `diario.test.ts`; E2E `diario.spec.ts`; captura `diario.png` |
| Por ítem: editar cantidad (el servidor recalcula desde la base), mover, duplicar, favorito, eliminar; procedencia visible | ✅ | `src/features/diary/server/{log-items,diary-ops}.ts` | `diario.test.ts`; `provenance.test.ts` |
| Por comida: copiar a otro día, guardar y aplicar plantilla, vaciar | ✅ (las plantillas guardan gramos, no la porción casera) | idem | `diario.test.ts` |
| Totales del día vs la meta vigente en esa fecha («≥» si a un ítem le falta el dato) | ✅ | `src/features/diary/lib/day-totals.ts`, vista `daily_nutrition_totals` | `diario.test.ts`; `day-totals.test.ts` |
| Agregar: menú de métodos y búsqueda en vivo con recientes y favoritos | ✅ | `/app/agregar`, `/app/agregar/buscar` | E2E `diario.spec.ts` (buscar → porción → diario con procedencia) |
| Ingreso manual rápido (nombre + kcal + macros, queda como estimación) | ✅ | `src/features/diary/components/manual-entry-dialog.tsx` | `diario.test.ts` |
| Alimentos propios: crear y editar (por 100 g o por porción), porciones caseras, eliminar sin perder lo registrado | ✅ (sin paginación) | `/app/alimentos`, `/app/alimentos/nuevo`, `/app/alimentos/[id]` | `diario.test.ts`; `own-food.test.ts` |

## Base de alimentos

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Búsqueda con y sin tildes, con porciones (60 por minuto) | ✅ | `GET /api/foods/search`, función `search_foods` | integración `foods.test.ts` («aji»/«ají»/«AJÍ»), `alimentos-api.test.ts` |
| Detalle con micronutrientes, procedencia y licencia | ✅ | `GET /api/foods/[id]` | `alimentos-api.test.ts` |
| Catálogo semilla: 196 alimentos de Perú y Latinoamérica y 276 porciones | ✅ / 🚧 valores aproximados y sin verificar | `supabase/seed/10_foods.sql`, `docs/DATA_SOURCES.md` | `scripts/check-seed.mjs` |
| Código de barras: cámara (BarcodeDetector o ZXing), linterna, ingreso manual con dígito verificador; busca primero en la base local | ✅ | `/app/agregar/codigo`, `GET /api/foods/barcode/[code]`, `src/lib/foods/barcode.ts` | `barcode.test.ts`; `alimentos-api.test.ts` (encontrado en la base, variante UPC-A) |
| Código que no está en la base → Open Food Facts → se guarda como alimento público sin verificar | 🔑 `SUPABASE_SERVICE_ROLE_KEY` (sin ella 503 `NOT_CONFIGURED`) + salida a internet (sin red 502 `UPSTREAM_ERROR`). OFF no pide clave | `src/features/foods/server/barcode-lookup.ts`, `src/lib/foods/open-food-facts.ts` | unitarias con OFF simulado; integración solo vio el 502 real (sin red) |
| Importador USDA FoodData Central (CLI y panel) | 🔑 `FDC_API_KEY` (+ service role en el panel). Sin ella `USDA_NOT_CONFIGURED` / «pendiente de configurar» | `src/lib/foods/usda*.ts`, `scripts/import-usda.ts`, `/admin/alimentos/importar` | unitarias con respuestas grabadas (`src/lib/foods/__fixtures__`); `admin.test.ts` (sin clave) |
| Detección de duplicados y fusión (staff) | ✅ | `src/lib/foods/dedup.ts`, `/admin/alimentos/duplicados`, `admin_merge_foods` | `dedup.test.ts`; `admin.test.ts` |
| Micronutrientes desde OFF; categoría del alimento | 🚧 No se importan; `foods` no tiene columna de categoría | — | — |

## Registro con IA

Todas estas funciones exigen Premium, el permiso `ai_processing` vigente y `ANTHROPIC_API_KEY`. Sin la
clave, la API responde **503 `AI_NOT_CONFIGURED`** antes de gastar cupo y la pantalla dice «IA pendiente
de configurar». La IA solo propone qué alimento y cuánto: los nutrientes salen de la base y nada se
registra sin que la persona confirme.

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Foto de la comida: tomar o subir, propuesta con rango de gramos y confianza, revisión editable | 🔑 `ANTHROPIC_API_KEY` | `/app/agregar/foto`, `POST /api/ai/photo` | `anthropic.test.ts` (SDK simulado), `image.test.ts` (sharp real), `review-panel.test.tsx`; integración `ia.test.ts` |
| Guardar la foto en un historial privado (opcional, desmarcado por defecto) | 🔑 idem | bucket `meal-photos` | `ia.test.ts` |
| Texto libre («Comí 150 g de pollo, una taza de arroz…») con preguntas de aclaración | 🔑 idem | `/app/agregar/texto`, `POST /api/ai/text` | `ia.test.ts` (texto → confirmación → diario, sin doble registro); E2E `integraciones.spec.ts` (503 sin clave, nada en el diario) |
| Voz con el dictado del navegador (Web Speech, es-PE) y luego el mismo flujo que texto | 🔑 `ANTHROPIC_API_KEY` | `/app/agregar/voz` | unitarias; recorrido de humo |
| Voz grabada y transcrita en el servidor | 🔑 `TRANSCRIPTION_PROVIDER=openai` + `OPENAI_API_KEY`. Sin ellas 503 `TRANSCRIPTION_NOT_CONFIGURED`; la pantalla ofrece el dictado o escribir | `POST /api/ai/transcribe`, `src/lib/ai/transcription.ts` | `transcription.test.ts` (fetch simulado); `ia.test.ts` (503) |
| Cupo mensual por plan (Premium: foto 120, texto 300, voz 300, chat 400), límite por minuto y costo estimado por solicitud | 🔑 idem (solo corre cuando hay llamada a la IA) | `src/lib/ai/{quota,pricing}.ts`, `consume_ai_quota` | `quota.test.ts`, `pricing.test.ts`; `ia.test.ts` (429 sin cupo) |
| Permiso de IA: se otorga desde la pantalla, se retira en Privacidad; la API lo exige (403 `CONSENT_REQUIRED`) | ✅ | `src/features/ai/server/http.ts` | `ia.test.ts` (sin permiso y con permiso retirado) |
| Estado de la IA para la interfaz | ✅ | `GET /api/ai/status` | `ia.test.ts` |
| Lista de «mis fotos de comidas» para verlas o borrarlas | 🚧 No existe (se borran con la cuenta y salen en la exportación) | — | — |

## Asistente

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Chat con respuesta en streaming, historial (abrir, borrar, nueva), aviso «No es consejo médico» con el 106 y la Línea 113 | 🔑 `ANTHROPIC_API_KEY` (Premium) | `/app/asistente`, `POST /api/ai/chat` | `assistant/server/chat.test.ts`; `ia.test.ts` (streaming con SDK simulado, negativa a mitad → nada guardado) |
| Contexto mínimo (meta y totales de hoy; nunca nombre, peso ni fotos) y reglas del cribado de riesgo | 🔑 idem | `src/features/assistant/lib/context.ts` | unitarias |
| Moderación por reglas (autolesión, señales de TCA, restricción extrema) → respuesta segura fija, sin llamar al modelo ni gastar cupo | 🔑 Solo corre con la clave configurada: sin ella la ruta responde 503 antes | `src/features/assistant/lib/moderation.ts` | unitarias (incluye falsos positivos); `ia.test.ts` |
| Modo cuidado (antecedente de TCA): sin cifras de calorías ni restricción | 🔑 idem | `context.ts` | unitarias |
| Sin Premium: leer y borrar conversaciones anteriores | ✅ | `/app/asistente` | Recorrido de humo (plan gratis) |

## Recetas, plan y compras

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Catálogo: 36 recetas oficiales de la semilla + propias; búsqueda sin tildes; filtros por comida, dieta, alérgenos (por defecto los del objetivo), tiempo y costo; favoritas; orden | ✅ | `/app/recetas`, `supabase/seed/20_recipes.sql` | integración `recetas.test.ts`; `recipes/lib/*.test.ts` |
| Detalle: porciones ajustables, nutrición calculada desde ingredientes, alérgenos, favorito, «Añadir al diario» | ✅ | `/app/recetas/[slug]` | `recetas.test.ts` |
| Crear y editar receta propia; guardar borrador o enviar a revisión | ✅ | `/app/recetas/nueva`, `/app/recetas/[slug]/editar` | `recetas.test.ts` (invisible para otra persona) |
| «Para tu meta de hoy» (reglas, sin IA) | ✅ (Premium) | `/app/recetas`, `src/features/recipes/lib/recommend.ts` | `recommend.test.ts` |
| Generar plan semanal determinista (kcal, proteína, alergias, dieta, presupuesto, tiempo) con piso de seguridad; bloqueado para perfiles de riesgo | ✅ (Premium) | `/app/plan/nuevo`, `src/lib/nutrition/planner.ts` | `planner.test.ts` (±10 %); `recetas.test.ts` (guardar, bloqueo); captura `plan.png` |
| Editar plan: cambiar receta, porciones, regenerar un día, plan manual; activar y archivar; registrar una comida del plan | ✅ (Premium) | `/app/plan`, `/app/plan/[id]` | `recetas.test.ts` |
| PDF del plan | ✅ (Premium) | `GET /api/plan/[id]/pdf` | `pdf.test.ts` (tildes y ñ) |
| Compartir el plan con enlace público (con consentimiento) y revocar | ✅ | `/compartido/plan/[token]`, `get_shared_plan` | `recetas.test.ts` (anónimo, sin datos personales) |
| Lista de compras desde el plan, por categorías, con 79 precios referenciales y presupuesto | ✅ (Premium para crear; ver y editar no lo exige) | `/app/compras`, `/app/compras/[id]` | `build.test.ts`; `recetas.test.ts` |
| Imágenes de las recetas oficiales | 🚧 La semilla trae `image_path` nulo: se ve el placeholder hasta que el staff suba cada imagen | `/admin/recetas/[id]` | `admin.test.ts` (subida WebP 1200×900) |
| Categorías de compra | 🚧 Por palabras clave del nombre | `src/features/shopping/lib/categorize.ts` | `build.test.ts` |

## Seguimiento

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Peso diario (uno por día) y % de grasa con su método, rotulado «estimación no clínica» | ✅ | `/app/progreso` | integración `seguimiento.test.ts`; captura `progreso.png` |
| Gráfico de peso con promedio móvil de 7 días, tendencia y proyección sin promesas | ✅ (30/90 días gratis; 6 meses y 1 año con Premium) | `/app/progreso`, `src/lib/nutrition/weight-trend.ts` | `analytics.test.ts`, `weight-trend.test.ts` |
| Comparación de periodos 7/30/90 días | ✅ (Premium) | idem | `analytics.test.ts` |
| Medidas corporales (7) con historial y gráfico | ✅ (historial completo con Premium) | `/app/progreso` | Recorrido de humo |
| Adherencia de la semana | ✅ | `src/lib/nutrition/adherence.ts` | `adherence.test.ts` |
| Con antecedente de TCA: sin números de peso, medidas ni proyecciones | ✅ | `getTrackingContext()` | unitarias |
| Fotos de progreso privadas: permiso propio, compresión en el navegador sin EXIF, URL firmadas de 1 h, comparación lado a lado | ✅ | `/app/progreso/fotos`, bucket `progress-photos` | `seguimiento.test.ts`, `storage.test.ts` (otra persona no lee, no firma ni sube) |
| Agua: 250/500/750 ml y personalizado, meta, deshacer, historial de 7/30 días | ✅ | `/app/agua` | `water-stats.test.ts`; recorrido de humo |
| Ayuno: 12:12 a 18:6 y personalizado, temporizador persistente, historial y estadísticas | ✅ | `/app/ayuno` | `seguimiento.test.ts` (una sola activa) |
| Bloqueo del ayuno para perfiles de riesgo (menores, embarazo, lactancia, IMC < 18.5, TCA, diabetes con medicación, enfermedad renal, datos incompletos) | ✅ | `src/features/fasting/lib/eligibility.ts` | `eligibility.test.ts`; `seguimiento.test.ts`; E2E `integraciones.spec.ts` (embarazo: sin botón para iniciar) |
| Aviso local al completar el ayuno (con la app abierta y permiso del navegador) | ✅ | `src/features/fasting/components/fasting-timer.tsx` | Sin prueba automatizada |
| Actividad: 48 actividades con MET, kcal netas calculadas en el servidor; ingreso manual de calorías del reloj | ✅ / 🚧 valores MET pendientes de cotejo con el Compendium oficial | `/app/actividad`, `src/lib/nutrition/exercise.ts` | `activity-calc.test.ts`, `exercise.test.ts` |
| Sincronización con Apple Health / Health Connect | 🚧 No existe (solo la arquitectura en `docs/INTEGRATIONS.md`) | — | — |
| Logros: insignias y retos voluntarios sin castigo, con aviso por logro nuevo | ✅ (lo hecho en recetas y planes se refleja al abrir `/app/logros`) | `/app/logros`, `src/features/gamification/server/sync.ts` | `habits.test.ts`, `gamification.test.ts` |
| Notificaciones dentro de la app: lista, marcar leídas, preferencias, notificación de prueba | ✅ | `/app/notificaciones`, `src/lib/notifications/notify.ts` | Recorrido de humo |
| Push al dispositivo | 🔑 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Sin ellas `POST /api/push/subscribe` responde 503, la UI dice «pendiente de configurar» y los avisos quedan dentro de la app | `/api/push/subscribe`, `src/lib/notifications/push.ts`, `public/sw.js` | `sw.test.ts` (payload y clics); nunca con claves VAPID reales |
| Recordatorios programados (agua, registro, pesaje, fin de ayuno) en la hora local de cada persona | 🔑 `CRON_SECRET` (16 caracteres o más) + `SUPABASE_SERVICE_ROLE_KEY` (sin ellas 503) + algo que llame la ruta: no hay `vercel.json` | `GET /api/cron/reminders`, `src/lib/notifications/scheduler.ts` | `reminders.test.ts`; `seguimiento.test.ts` (401 sin secreto, 200 sin duplicar) |

## Premium y pagos

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Planes y precios leídos de la base (Premium: S/ 29.90 al mes o S/ 199.90 al año; US$ 7.99 o 54.99), ahorro anual, prueba de 7 días | ✅ | `/precios`, tablas `plans` y `plan_prices` | `pagos-paginas.test.ts`, `landing.test.ts` |
| Página Premium: elegir periodo y medio de pago; si un medio no está disponible dice por qué | ✅ (sin claves, botones deshabilitados con «Pagos pendientes de configurar.») | `/app/premium` | `pagos-paginas.test.ts`; unitarias de componentes |
| Checkout con tarjeta internacional (Stripe, USD) | 🔑 `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `stripe_price_id` en cada precio. Sin claves 503 `BILLING_NOT_CONFIGURED`; sin `stripe_price_id` 503 `PRICE_NOT_CONFIGURED` | `POST /api/billing/checkout`, `src/lib/billing/stripe.ts` | E2E `integraciones.spec.ts` (503, sin suscripción creada); `stripe.test.ts` |
| Checkout con Mercado Pago (PEN) | 🔑 `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET` y encender `payments_mercadopago` (la semilla lo trae apagado → 503 `PROVIDER_DISABLED`) | `src/lib/billing/mercadopago.ts` | E2E (503); `mercadopago.test.ts` (fetch simulado) |
| Webhooks firmados e idempotentes que activan, actualizan o quitan Premium | 🔑 secreto del webhook + `SUPABASE_SERVICE_ROLE_KEY` (sin ellos 503; firma inválida 400) | `/api/billing/webhooks/{stripe,mercadopago}`, `src/lib/billing/sync.ts` | `pagos.test.ts`: eventos firmados en local (`generateTestHeaderString`, HMAC real) y API de Mercado Pago simulada |
| Confirmación después de pagar («Estamos confirmando tu pago») | 🔑 idem | `/app/premium/gracias`, `POST /api/billing/confirm` | `pagos.test.ts`, `pagos-paginas.test.ts` |
| Mi suscripción: estado, próximo cobro, historial de pagos | ✅ | `/app/perfil/suscripcion` | `pagos-paginas.test.ts` |
| Cancelar la renovación y gestionar el pago (portal de Stripe o panel de Mercado Pago) | 🔑 claves del proveedor (+ service role para cancelar). Sin ellas, botones deshabilitados y 503 | `POST /api/billing/{cancel,portal}` | `pagos.test.ts` (404 sin suscripción, 503 sin claves) |
| El acceso Premium lo decide solo la base (`is_premium()`) | ✅ | `src/lib/billing/entitlements.ts` | `functions.test.ts`, `pagos.test.ts` |
| Reembolsos, facturación electrónica (SUNAT), cambio de plan y reactivación en Mercado Pago | 🚧 No existen | — | — |

## Privacidad y datos (Ley N.° 29733)

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Consentimientos versionados (`2026-10`): términos y privacidad al registrarse; datos de salud obligatorio en el onboarding con texto propio que cita la ley; IA y novedades opcionales; se guardan también los no otorgados | ✅ | `src/features/auth/consents.ts`, tabla `consents` | `auth-onboarding.test.ts`, `auth-signup.test.ts`; E2E de registro |
| Privacidad: historial de cada permiso y switch para IA, fotos de progreso y novedades | ✅ | `/app/perfil/privacidad` | Recorrido de humo; `ia.test.ts` (permiso retirado → 403) |
| Retirar el permiso de datos de salud: `/app` queda en pausa hasta volver a autorizar | ✅ en la interfaz / 🚧 la base no bloquea las escrituras propias (ver Pendiente) | `/app/perfil/privacidad`, `/onboarding` | `auth-onboarding.test.ts` |
| Exportación de datos (derecho de acceso): JSON con todas las tablas propias y URL firmadas de 1 h de las fotos; 5 por hora | ✅ (no incluye `error_reports`) | `GET /api/account/export` | `auth-account.test.ts` (solo datos propios aunque la persona sea profesional) |
| Eliminación de cuenta: borra archivos y usuario en cascada, deja auditoría sin datos de salud; 409 si una suscripción sigue cobrando | 🔑 `SUPABASE_SERVICE_ROLE_KEY` (sin ella 503 y no borra nada) | `POST /api/account/delete`, `src/features/profile/server/delete-account.ts` | `auth-account.test.ts` |
| Dar acceso a un profesional por correo («Solo ver» o «Ver y ajustar metas»), lista y retiro | 🔑 `SUPABASE_SERVICE_ROLE_KEY` para buscar por correo (sin ella «pendiente de configurar»); ver y retirar accesos no la necesita | `/app/perfil/profesional` | `professional-access.test.ts`, `auth-professional.test.ts` |
| Vista del profesional: personas que le dieron acceso, meta, totales de 7 días, pesajes; fijar meta | ✅ (el rol `professional` lo da un superadmin en `/admin/usuarios`) | `/app/perfil/profesional/pacientes/[userId]` | idem |
| Aislamiento entre personas por RLS (registros, totales, fotos y Storage) | ✅ | `supabase/migrations/20261013000010_rls.sql`, `20261013000011_storage.sql` | `user-data-isolation.test.ts`, `storage.test.ts`, `diario.test.ts`, `recetas.test.ts` |
| Sin permiso de salud vigente, ningún profesional lee ni escribe los registros de la persona; el cron no avisa a perfiles en pausa | ✅ | `supabase/migrations/20261014090001_consent_and_role_hardening.sql`, `src/lib/notifications/scheduler.ts` | `professional-access.test.ts`, `seguimiento.test.ts` |
| El rol `superadmin` solo se da o quita por SQL (las políticas de `user_roles` lo excluyen) | ✅ | misma migración | `profiles-roles-billing.test.ts` |
| Textos legales (términos, privacidad, datos de salud) | 🚧 En borrador con marcadores; `/legal/*` muestra «Documento en preparación» | `supabase/seed/00_base.sql`, `/admin/contenidos` | `landing.test.ts` |

## Panel admin

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Rol exigido en cada página y acción (editor ⊂ admin ⊂ superadmin); sin rol, 404; el menú oculta a un editor las secciones de admin | ✅ | `src/app/admin/layout.tsx`, `src/features/admin/server/action.ts`, `src/components/admin/admin-shell.tsx` | E2E `seguridad.spec.ts`; `admin.test.ts` |
| Dashboard: colas de trabajo, métricas sin datos personales, estado de las integraciones sin mostrar valores | ✅ | `/admin`, `integrationStatus()` | `admin.test.ts`; recorrido de humo |
| Usuarios: lista y búsqueda por correo; un superadmin otorga o quita `editor`, `admin` y `professional` | 🔑 `SUPABASE_SERVICE_ROLE_KEY` para listar (sin ella «pendiente de configurar») | `/admin/usuarios` | `admin.test.ts` |
| Alimentos: catálogo, crear y editar con procedencia obligatoria, cola de verificación, duplicados y fusión, precios referenciales | ✅ | `/admin/alimentos/**` | `admin.test.ts` |
| Importar desde USDA | 🔑 `FDC_API_KEY` + service role | `/admin/alimentos/importar` | `admin.test.ts` (sin clave) |
| Recetas: publicar o rechazar con motivo (aviso al autor) y editar las oficiales con imagen (WebP 1200×900) | ✅ | `/admin/recetas/**` | `admin.test.ts` |
| Contenidos: FAQ, legales, bloques y artículos con markdown seguro y vista previa | ✅ / 🚧 `landing_block` y `article` no se muestran en ninguna página | `/admin/contenidos/**` | `admin.test.ts`; unitarias de markdown |
| Planes y precios: funciones, cupos de IA, precios y `stripe_price_id` | ✅ (no se crean ni borran planes) | `/admin/planes` | `admin.test.ts` |
| Uso de IA: solicitudes, costo y errores por mes, tipo y modelo | ✅ (vacío hasta que haya IA real) | `/admin/ia` | `admin.test.ts` |
| Configuración: nombre de la app, correo de soporte, días de prueba, aviso de mantenimiento, interruptores | ✅ / 🚧 solo los interruptores de pagos tienen efecto; los demás dicen «Sin efecto todavía» | `/admin/configuracion` | `admin.test.ts` |
| Auditoría de acciones del staff y errores del navegador | ✅ (sin service role la auditoría muestra ids en vez de correos) | `/admin/auditoria`, `/admin/errores` | `admin.test.ts` |

## Landing, PWA y legal

| Función | Estado | Ruta o archivo | Cómo se prueba |
|---|---|---|---|
| Portada: propuesta, 12 funciones con etiqueta Gratis/Premium leída de la base, precios de la base, FAQ, llamado a crear cuenta | ✅ | `/` | `tests/unit/landing-pages.test.tsx`; recorrido de humo |
| Capturas reales en marco de teléfono: inicio, diario, plan y progreso | ✅ | `public/screenshots/*.png`, `scripts/capture-screenshots.ts`, `screenshots.available.ts` | Archivos presentes |
| Captura «foto con IA» | 🚧 «Captura en preparación»: necesita IA real | `src/features/marketing/screenshots.available.ts` | — |
| `/funciones`, FAQ (solo publicadas, con JSON-LD) y aviso de cuenta eliminada | ✅ | `/funciones`, `/faq`, `/?cuenta=eliminada` | `landing.test.ts`; recorrido de humo |
| SEO: metadatos, sitemap, robots, imagen OG 1200×630, JSON-LD sin valoraciones | ✅ (`NEXT_PUBLIC_SITE_URL` para las URL absolutas; sin ella usa `http://localhost:3000`) | `src/app/{sitemap,robots}.ts`, `src/app/opengraph-image.tsx` | `seo.test.ts`, `opengraph-image.test.tsx`; E2E (los 4 archivos responden 200) |
| PWA: manifest, iconos, service worker (no cachea `/api`, `/auth` ni respuestas privadas), página sin conexión, botón «Instalar app» | ✅ (el SW se registra en producción o con `NEXT_PUBLIC_ENABLE_SW=true`) | `src/app/manifest.ts`, `public/sw.js`, `public/offline.html`, `src/components/pwa/` | `sw.test.ts`, `pwa.test.ts` |
| Pantallas de error y 404 con reporte saneado (20 por hora por IP, 60 por usuario) | ✅ | `src/app/{error,global-error,not-found}.tsx`, `POST /api/errors` | `src/app/api/errors/route.test.ts`, `error-report.test.ts`; `landing.test.ts` |
| Aviso de mantenimiento | ✅ / 🚧 solo en el sitio público (no en `/app` ni en `/precios`) | `src/app/(marketing)/layout.tsx` | — |
| Registrar comidas sin conexión | 🚧 No existe (decisión: nada simulado) | — | — |

## Requiere credenciales

| Servicio | Variable(s) | Qué hace la app sin ella |
|---|---|---|
| Supabase (base) | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | Pantallas con `SetupRequired`; API 503. No hay cuentas ni datos |
| Supabase (servicio) | `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`) | 503 en: eliminar cuenta, webhooks de pago, cancelar y confirmar pagos, cron, guardar productos de Open Food Facts. «Pendiente de configurar» en: buscar profesional por correo, usuarios del admin, importación USDA. Auditoría con ids en vez de correos; «tu profesional» en vez del nombre |
| Correo (SMTP) | Se configura en Supabase Auth, no en la app | En producción no llegan la confirmación ni la recuperación. En local llegan a Mailpit |
| URL pública | `NEXT_PUBLIC_SITE_URL` | Usa `http://localhost:3000` en correos, retornos de pago, sitemap y metadatos; Mercado Pago rechaza retornos sin https |
| Google | `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` + cliente OAuth cargado en Supabase (en local: `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`, leídas por `supabase/config.toml`) | No aparece el botón de Google |
| Anthropic (IA) | `ANTHROPIC_API_KEY`; opcionales `AI_MODEL_VISION`, `AI_MODEL_TEXT`, `AI_MODEL_CHAT` (por defecto `claude-opus-5-5`) | `/api/ai/{photo,text,chat}` → 503 `AI_NOT_CONFIGURED` sin gastar cupo; la UI dice «IA pendiente de configurar» |
| OpenAI (transcripción, opcional) | `TRANSCRIPTION_PROVIDER=openai`, `OPENAI_API_KEY`; opcional `OPENAI_TRANSCRIPTION_MODEL` | `/api/ai/transcribe` → 503 `TRANSCRIPTION_NOT_CONFIGURED`; la voz usa el dictado del navegador |
| Stripe | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (las dos) y `plan_prices.stripe_price_id` | Checkout, portal y cancelar → 503 `BILLING_NOT_CONFIGURED`; webhook 503; UI «Pagos pendientes de configurar.» o «Precio pendiente de configurar en Stripe.» |
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN` + `MERCADOPAGO_WEBHOOK_SECRET` y `feature_flags.payments_mercadopago = true` | 503 `BILLING_NOT_CONFIGURED` o `PROVIDER_DISABLED`; UI «no disponible por ahora» |
| USDA FoodData Central | `FDC_API_KEY` | `USDA_NOT_CONFIGURED`; el panel dice «pendiente de configurar» |
| Open Food Facts | No pide clave: necesita salida a internet y la clave de servicio | 502 `UPSTREAM_ERROR` sin red; 503 `NOT_CONFIGURED` sin clave de servicio |
| Push (VAPID) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `/api/push/subscribe` 503; UI «pendiente de configurar»; los avisos quedan dentro de la app |
| Cron de recordatorios | `CRON_SECRET` (16 caracteres o más) + clave de servicio + un programador (Vercel Cron o externo) | `/api/cron/reminders` 503; sin programador nunca corre |

Ojo: un `CRON_SECRET` de menos de 16 caracteres o un `TRANSCRIPTION_PROVIDER` distinto de `none`/`openai`
hace fallar `serverEnv()` (`src/lib/server-env.ts`) y con eso todo lo de servidor que la lee: IA, pagos,
cron, admin y eliminar cuenta.

**Anthropic, OpenAI, Stripe, Mercado Pago, USDA, VAPID/push y Google nunca se probaron contra el servicio
real**: solo con SDK o `fetch` simulados, respuestas grabadas o firmas generadas en local. Open Food Facts
solo devolvió 502 (sin red en el entorno de pruebas).

## Pendiente

### Riesgos abiertos de `docs/SECURITY.md` §13

El riesgo 6 (un superadmin podía crear superadmins por la API) ya está corregido y no figura aquí.

| # | Riesgo | Estado en el código |
|---|---|---|
| 1 | Correo de soporte de ejemplo (`soporte@example.com`), visible y enviado a Open Food Facts | Abierto: sigue en `supabase/seed/00_base.sql` |
| 2 | Términos, privacidad y datos de salud en borrador con marcadores (`[RAZÓN SOCIAL]`, `[RUC]`…) | Abierto: los tres en `draft` |
| 3 | Sin MFA para usuarios ni staff | Abierto: `enroll_enabled = false` en `supabase/config.toml` |
| 4 | Sin Content-Security-Policy; cookies de sesión legibles por JS | Abierto: ni `next.config.ts` ni `src/proxy.ts` definen CSP |
| 5 | Con el permiso de salud retirado, la base no bloquea las escrituras propias | Parcial: profesionales y cron ya respetan la pausa (migración `20261014090001`); el RLS de las tablas propias no mira `consents`, así que quien llame la API directo puede seguir escribiendo. Falta decidir si se bloquea |
| 7 | Alcance amplio del staff (admin lee todos los `profiles`; editor lee borradores ajenos) | Abierto |
| 8 | Límite anónimo por IP depende de `x-forwarded-for` | Abierto: confirmar con el hosting |
| 9 | `rate_limits` crece sin limpieza | Abierto |
| 10 | Contraseñas solo con largo ≥ 8, sin captcha, cambio sin reautenticación; límites de GoTrue solo en local | Abierto |
| 11 | Cualquier usuario puede subir imágenes a su carpeta del bucket público `recipe-images` | Abierto (`20261013000011_storage.sql`) |
| 12 | Un código de barras nuevo crea un alimento público sin verificar; marcas legibles por todos | Abierto |
| 13 | El borrador del onboarding (con condiciones de salud) queda en `localStorage` si se abandona | Abierto: solo se descarta para el guardado automático pasados 7 días, no se borra |
| 14 | Límites de la eliminación de cuenta; `payments` se borra en cascada | Aceptado por ahora; revisar con el criterio legal de conservación |
| 15 | HSTS con `preload` e `includeSubDomains` | Confirmar antes de enviar el dominio a la lista de precarga |
| 16 | Integraciones no probadas en real | Abierto (ver arriba) |
| 17 | Moderación del asistente por lista de expresiones | Abierto: revisar con un profesional de salud |
| 18 | `error.message` técnico en algunos logs (alimentos, código de barras, pagos) | Abierto |
| 19 | Cerrar sesión solo cierra este dispositivo; no hay cambio de correo | Abierto (`scope: "local"`) |

### Despliegue

- **No hay `vercel.json`**: los recordatorios no están programados. `docs/DEPLOYMENT.md` §8.3 trae el
  contenido; en el plan Hobby de Vercel solo se permite una ejecución al día.
- Datos semilla por revisar: 196 alimentos sin verificar, 36 recetas sin revisión profesional ni imagen, 79
  precios referenciales sin fuente verificada.
- Mercado Pago viene apagado (`payments_mercadopago = false`) y ningún precio tiene `stripe_price_id`.
- Antes de abrir: correo de soporte, nombre definitivo, legales publicados, SMTP propio, respaldos
  (`docs/DEPLOYMENT.md` §10.2).

### Funciones faltantes o parciales

- Captura «foto con IA» de la portada («Captura en preparación»).
- Flujos con IA real (foto → confirmación → diario, asistente): nunca ejecutados contra Anthropic.
- «Ajustes» del presupuesto diario siempre en 0 (no hay tabla).
- Cuenta: sin cambio de correo, sin MFA, sin «cerrar en todos». La búsqueda de profesionales sirve para
  cientos de cuentas, no para decenas de miles.
- Diario: las plantillas guardan gramos (no la porción casera); sin paginación en «mis alimentos» ni en
  recientes.
- Alimentos: no se importan micronutrientes de Open Food Facts; `foods` no tiene categoría (compras y retos
  de verduras usan palabras clave del nombre).
- IA: no hay lista de «mis fotos de comidas»; el costo de la transcripción no se estima.
- Pagos: sin reembolsos dentro de la app, sin facturación electrónica (SUNAT), cambio de plan solo desde el
  portal de Stripe, en Mercado Pago no se reactiva una suscripción cancelada y la prueba gratis depende de
  la cuenta; `mercadopago_plan_id` no se usa.
- Recetas: `/app/agregar` enlaza a `/app/recetas` sin fecha ni comida; recetas propias sin costo; publicar
  una receta de usuario exige que todos sus ingredientes sean públicos.
- Seguimiento: sin Apple Health / Health Connect; MET pendientes de cotejo; los logros de recetas y planes
  se otorgan recién al abrir `/app/logros`; el RLS deja insertar `user_badges` directo por la API; sin
  E2E de cámara ni compresión de fotos.
- Admin: no crea ni borra planes; no borra alimentos (los rechaza o fusiona); búsqueda de usuarios solo
  por correo; `landing_block` y `article` sin página que los muestre; interruptores sin efecto salvo los
  de pagos; dos renderizadores de markdown (panel y sitio) que pueden diferir en estilo.
- Landing: el aviso de mantenimiento solo sale en el sitio público; `/precios` no tiene el enlace «Saltar
  al contenido»; no se registra nada sin conexión.

## Cómo se verificó

Cifras de la última corrida completa registrada (`docs/QA_LOG.md`, Fase A, commit `b2eb720`):

- **E2E 14/14** (Playwright contra `next start`, 390 × 844):
  - `registro-onboarding.spec.ts`: onboarding sin cuenta → registro → correo real en Mailpit →
    confirmación → `/app` con la meta guardada y los consentimientos registrados.
  - `diario.spec.ts`: buscar → porción → diario, con nutrientes calculados en el servidor y procedencia.
  - `seguridad.spec.ts` (4): sin sesión `/app` y `/admin` mandan a ingresar; `/admin` da 404 sin rol;
    un editor entra; las API de datos personales exigen sesión. El aislamiento entre personas se prueba en
    integración (`user-data-isolation.test.ts`, `storage.test.ts`).
  - `integraciones.spec.ts` (3): ayuno bloqueado por embarazo; IA 503 `AI_NOT_CONFIGURED` sin nada en
    el diario; checkout 503 con Stripe y Mercado Pago sin suscripción creada.
  - `smoke.spec.ts` (5): recorrido por rol a 390 px sin errores de consola ni desborde. En el código son
    85 pantallas (15 públicas, 38 con Premium, 11 en plan gratis, 21 de admin) + 4 archivos de SEO y PWA.
- **Integración 203/203** (Vitest contra Supabase local).
- **Unitarias 1065** (Vitest).
- Lint y typecheck en 0; build sin advertencias.
- Integraciones externas: solo simulaciones o firmas locales (ver «Requiere credenciales»).

Repetido el 2026-10-14 sobre el commit `1df5779` (agrega pruebas de permiso de salud, rol superadmin y
cron, y corrige dos inestables): **integración 203/203** y **unitarias 1065/1065**. Antes de ese commit,
una de cuatro corridas unitarias tuvo 2 fallos intermitentes que no se repitieron. El E2E no se volvió a
correr.
