# Seguridad y protección de datos — ORANGE FIT

Qué protege la app, cómo lo hace y qué falta, contrastado con el código y las migraciones. Arquitectura
general en `docs/ARCHITECTURE.md`; tablas y funciones en `docs/DATA_MODEL.md`.

> Este documento no es asesoría legal. Los textos legales de la app son **borradores** y deben pasar por
> un abogado antes de publicarse (ver §10 y §13).

## 1. Modelo de amenazas (breve)

**Qué protegemos:** datos de salud (peso, medidas, fotos de progreso, condiciones declaradas, diario de
comidas), la cuenta, el estado de pago, las claves de los servicios y el costo de la IA.

| Amenaza | Ejemplo | Defensa principal |
|---|---|---|
| Una persona lee o cambia datos de otra | Cambiar un id en una petición | RLS `user_id = auth.uid()` en cada tabla con datos personales; el servidor usa el `user_id` de la sesión, nunca el del cliente |
| Visitante sin sesión entra a zonas privadas | Abrir `/app` o `/api/account/export` | `src/proxy.ts` + guardas `requireUser` / 401 en las rutas |
| Escalar privilegios | Darse un rol o Premium | `user_roles` solo lo escribe un superadmin; `subscriptions`/`payments` solo el service role |
| Pago falso | Webhook inventado o repetido | Firma del proveedor + idempotencia en `billing_events` + consulta del recurso real (Mercado Pago) |
| Abuso de costos | Lanzar cientos de análisis de IA | Premium + consentimiento + cupo mensual + límite por minuto |
| Fuga de secretos | Clave en el JavaScript del navegador | `import "server-only"`, `serverEnv()`, solo `NEXT_PUBLIC_*` llega al navegador |
| XSS | Markdown malicioso en contenidos | Render de markdown sin HTML crudo; enlaces filtrados |
| CSRF | POST desde otro sitio | Server Actions (Next compara origen); POST sensibles con `isSameOrigin`; cookies `SameSite=Lax` |
| Inyección en la IA | Texto con instrucciones dentro de la foto | Prompts que lo ignoran, salida validada con Zod, confirmación obligatoria |
| Personal interno curioso | Un admin mirando datos de salud | El panel no muestra datos de salud; el RLS no da al staff los registros de salud (con matices, §3.2) |
| Fuga por logs | Un error que imprime el contenido | Logs con códigos e ids; reportes del navegador saneados |

Fuera de alcance de la app: el compromiso de la cuenta de Supabase o del hosting, y un dispositivo de la
persona ya comprometido.

## 2. Autenticación y sesiones

- **Supabase Auth con `@supabase/ssr`** y sesión en cookies. Tres clientes (`src/lib/supabase/`):
  `client.ts` (navegador, clave pública), `server.ts` (servidor con las cookies del usuario: RLS aplica) y
  `admin.ts` (service role: se salta RLS, ver §5).
- **`src/proxy.ts` → `updateSession()`** (`src/lib/supabase/proxy.ts`) llama `auth.getClaims()` en cada
  petición, refresca las cookies y manda a `/ingresar?next=…` a quien entra a `/app` o `/admin` sin sesión.
  **No autoriza nada más**: solo evita pintar pantallas privadas.
- **Las guardas usan `auth.getUser()`**, que valida la sesión contra el servidor de Auth (no solo la
  cookie): `getUser`/`requireUser`/`requireRole` en `src/lib/auth/session.ts` (cacheado por petición) y,
  en los route handlers, `requireApiUser`, `guardAiRoute` y `getBillingSession`; las rutas de cuenta, push
  y PDF llaman `auth.getUser()` directamente.
- **Correo y contraseña**: mínimo 8 caracteres (`minimum_password_length = 8` en `supabase/config.toml`; la
  app pide además máximo 72 por bcrypt). Confirmación de correo obligatoria (`enable_confirmations = true`).
  Las plantillas `supabase/templates/*.html` usan `token_hash`, así el enlace funciona en otro navegador.
  `/recuperar` responde igual exista o no la cuenta.
- **Redirecciones seguras**: `safeNext()` (`src/features/auth/redirect.ts`) solo acepta rutas internas
  (rechaza `//`, `/\`, `https:`, caracteres de control y pantallas de ingreso).
- **Cerrar sesión**: `POST /auth/salir` con comprobación de origen y `signOut({ scope: "local" })` (solo este
  dispositivo).
- **Las llamadas de ingreso y registro salen del navegador** a propósito: el límite por IP de GoTrue mira la
  IP real. En el Supabase local: `sign_in_sign_ups = 30` cada 5 min por IP y `email_sent = 2` por hora
  (`[auth.rate_limit]` en `supabase/config.toml`). En la nube esos valores se configuran en el panel.
- **Tokens**: `jwt_expiry = 3600`, rotación de refresh tokens activa. Cookies con los valores por defecto
  de `@supabase/ssr`: `SameSite=Lax` y **no** `httpOnly` (el cliente del navegador necesita leerlas; ver §13).
- **Google**: opcional y apagado por defecto. Depende de credenciales y de activar el proveedor en Supabase;
  no se probó con un cliente OAuth real.
- **No hay**: MFA (`[auth.mfa.totp] enroll_enabled = false`), captcha, reglas de complejidad de contraseña
  (`password_requirements = ""`), reautenticación para cambiar la contraseña (`secure_password_change =
  false`), cambio de correo ni «cerrar sesión en todos los dispositivos».

## 3. Autorización

### 3.1 Roles

| Rol | Incluye | Qué puede |
|---|---|---|
| (sin fila) | — | Persona usuaria: solo sus datos |
| `editor` | — | Panel: alimentos, recetas, contenidos, errores |
| `admin` | editor | Además: usuarios (lectura), planes y precios, configuración, IA, auditoría |
| `superadmin` | admin, editor | Además: otorgar y quitar roles |
| `professional` | — (aparte) | Leer datos de quien le dio acceso y, con el alcance de escritura, fijar metas |

- Los roles viven en `user_roles` (pk `user_id, role`). En SQL, `public.has_role(role)`
  (`supabase/migrations/20261013000002_users.sql`, `security definer`) aplica la jerarquía
  superadmin ⊃ admin ⊃ editor; `professional` no se hereda. En TypeScript, `hasRole()` hace lo mismo
  (`src/lib/auth/session.ts`).
- `requireRole(role)`: sin sesión → `/ingresar`; sin rol → `notFound()` (404, no revela que el panel existe).
  El layout de `/admin` exige `editor`, y además **cada página y cada Server Action** exige su propio rol
  (`runAdminAction`, `src/features/admin/server/action.ts`).
- Solo un superadmin escribe en `user_roles` (políticas `user_roles_*_superadmin`). El primer superadmin se
  crea por SQL. El rol `superadmin` no se otorga, cambia ni quita por la API: lo rechazan Zod en el panel
  y las políticas de `user_roles` (migración `20261014090001`); solo por SQL.
- `professional_access`: la persona da y retira el acceso; un trigger (`validate_professional_access`) solo
  acepta cuentas con rol `professional`; `has_professional_access(user, require_write)` exige acceso vigente
  y, para escribir metas, el alcance `read_logs_write_targets`.

### 3.2 RLS en todas las tablas

`supabase/migrations/20261013000010_rls.sql` activa RLS en las 48 tablas de `public`. Una tabla sin
política para una operación queda cerrada. Patrones: dueño `user_id = (select auth.uid())`, staff
`has_role('editor')`, admin `has_role('admin')`, profesional `has_professional_access(user_id)`.

| Tablas | Política clave | Qué garantiza |
|---|---|---|
| Registros personales: `meal_logs`, `water_logs`, `weight_logs`, `body_measurements`, `progress_photos`, `fasting_sessions`, `exercise_logs`, `meal_plans`, `shopping_lists`, `notifications`, `push_subscriptions`, `assistant_conversations`… | `*_own` en select/insert/update/delete con `user_id = auth.uid()` | Nadie ve ni escribe filas ajenas |
| Hijos: `meal_log_items`, `meal_plan_items`, `shopping_list_items`, `meal_template_items`, `assistant_messages` | insert/update exigen que el padre también sea tuyo | No colgarse de la comida o el plan de otra persona |
| `profiles` | dueño; `profiles_select_admin`; `profiles_select_professional` | Sin DELETE: el perfil se va con la cuenta |
| `nutrition_targets` | el dueño solo inserta `source` `auto`/`manual`; el profesional solo `professional`, con `created_by = auth.uid()` y acceso de escritura | Nadie se hace pasar por profesional |
| `foods` | lectura de públicos (también anon), propios y staff; el dueño solo crea no públicos, `unverified`, fuente `user`/`open_food_facts`/`usda` | Una persona no publica ni «verifica» alimentos |
| `recipes` | publicadas y públicas, propias o staff; el dueño solo guarda `draft`/`pending_review` | Publicar es del staff; triggers `guard_recipe_review_fields` y `enforce_public_recipe_foods` |
| `consents` | solo select e insert propios | Historial inalterable |
| `subscriptions`, `payments` | lectura del dueño y de admin; insert/update/delete revocados (`…0012_grants.sql`) | Solo el service role escribe pagos |
| `ai_analysis_requests` | solo lectura propia; escrituras revocadas | El cupo solo cambia vía `consume_ai_quota`/`complete_ai_request` |
| `admin_audit_logs` | lectura admin; escrituras revocadas | Solo `log_admin_action()` escribe |
| `billing_events`, `rate_limits` | sin políticas y `revoke all` | Inaccesibles desde la API |
| `app_settings` | anon/usuarios leen solo claves `is_public`; escribe admin | |
| `error_reports` | anon inserta con `user_id null`; con sesión, a su nombre o null; lee el staff | No se reporta a nombre de otro |
| `meal_plans` compartidos | sin política pública | Lectura por token solo vía `get_shared_plan()` |

Lo que el RLS permite al personal **además** de lo que muestra el panel (por diseño, pero conviene saberlo):

- **admin** lee todos los `profiles` (incluye fecha de nacimiento, sexo para el cálculo y estatura),
  `subscriptions`, `payments`, `user_roles` y las claves privadas de `app_settings`.
- **editor y superiores** leen todos los `foods` (también los alimentos propios de cada persona), todas las
  recetas (también borradores privados), `error_reports` y contenidos en borrador.
- Nadie del staff lee por RLS el diario, peso, medidas, fotos, ayunos, ejercicio, objetivos, metas,
  consentimientos ni conversaciones del asistente.
- Un **profesional con acceso vigente** lee `profiles`, `user_goals` (incluye `health_flags`),
  `nutrition_targets`, `meal_logs`, `meal_log_items` y `weight_logs` de esa persona.

Pruebas: `tests/integration/user-data-isolation.test.ts`, `profiles-roles-billing.test.ts`,
`professional-access.test.ts`, `admin.test.ts`, `tests/e2e/seguridad.spec.ts`.

### 3.3 Funciones `security definer` y sus chequeos

Todas llevan `set search_path = ''` y nombres calificados. `…0012_grants.sql` quita `EXECUTE` de todas las
funciones a `public`, `anon` y `authenticated` y lo devuelve solo a las que usa la app.

| Función | Quién la ejecuta | Chequeo interno |
|---|---|---|
| `has_role(role)` | anon, authenticated | Usa `auth.uid()`; sin sesión, false |
| `has_professional_access(user, write)` | authenticated | Rol `professional` + acceso no revocado (+ alcance de escritura) |
| `is_premium(uid)` | authenticated | Solo sobre uno mismo salvo admin/service role (si no, error 42501) |
| `consume_ai_quota(kind)` | authenticated | Exige sesión; candado por usuario (`pg_advisory_xact_lock`); mes en la zona del perfil; crea la fila `pending` |
| `complete_ai_request(…)` | authenticated | Solo la solicitud propia y solo `pending` → final una vez; si devuelve false, no se entrega el resultado |
| `check_rate_limit(bucket, max, window)` | anon, authenticated, service role | Valida parámetros; clave = bucket + usuario, o bucket + IP (`x-forwarded-for`) para anon |
| `log_admin_action(…)` | authenticated, service role | Editor+ o service role |
| `admin_metrics()`, `admin_ai_usage()` | authenticated, service role | Admin o service role; solo agregados |
| `admin_merge_foods(keep, drop)` | authenticated, service role | Editor+ o service role |
| `get_shared_plan(token)` | anon, authenticated | Token de 16+ caracteres; devuelve el plan sin `user_id` ni ids |
| `search_foods(query, max)` | anon, authenticated | Filtra públicos o propios y sin rechazados; escapa comodines de LIKE |
| `register_push_subscription(…)` | authenticated | Exige sesión; endpoint `https://` de hasta 2000 caracteres; reasigna el endpoint a la cuenta actual |
| Triggers: `handle_new_user`, `handle_deleted_user`, `guard_recipe_review_fields`, `enforce_public_recipe_foods`, `enforce_error_report_rate_limit`, `validate_professional_access`, `notify_recipe_review`, `notify_professional_target` | — (no expuestos como RPC) | Integridad y avisos que el RLS no permitiría escribir a quien los origina |

## 4. Storage

`supabase/migrations/20261013000011_storage.sql`:

| Bucket | Público | Límite | Quién escribe | Quién lee |
|---|---|---|---|---|
| `progress-photos` | No | 10 MB, `image/*` | Dueño en `{user_id}/…` | Dueño, con URL firmada |
| `meal-photos` | No | 10 MB, `image/*` | Dueño en `{user_id}/…` | Dueño, con URL firmada |
| `recipe-images` | Sí | 10 MB, `image/*` | Staff en cualquier ruta; dueño en `{user_id}/…` | Cualquiera |

- La regla de carpeta es `(storage.foldername(name))[1] = auth.uid()::text` en select, insert, update y delete.
- **Fotos de progreso**: requieren el consentimiento `progress_photos`. El servidor decide la ruta
  (`{uid}/{fecha}-{pose}-{aleatorio}.webp`), el navegador sube con su sesión y `savePhotoAction` comprueba
  ruta, existencia y permiso; si algo falla, borra el archivo. El navegador recomprime con canvas (se
  pierden EXIF y GPS). Se muestran con URL firmadas de 1 h (`PHOTO_SIGNED_URL_SECONDS`), sin optimizador de
  imágenes y con `referrerPolicy="no-referrer"`.
- **Fotos de comidas (IA)**: solo se guardan si la persona marca la opción (desmarcada por defecto), en
  `meal-photos/{uid}/{fecha}/{requestId}.jpg`, ya re-codificadas con sharp sin metadatos. Si el análisis
  falla, se borran.
- **Imágenes de recetas oficiales**: el staff las sube; el servidor las normaliza con sharp a WebP sin metadatos.
- Pruebas: `tests/integration/storage.test.ts`, `tests/integration/seguimiento.test.ts`.

## 5. Secretos

- Al navegador solo llegan `NEXT_PUBLIC_*`: URL y clave pública de Supabase, URL del sitio, nombre de la
  app, clave pública VAPID y dos interruptores (`NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, `NEXT_PUBLIC_ENABLE_SW`).
  Se validan en `src/lib/env.ts`.
- Todo lo demás se lee con `serverEnv()` (`src/lib/server-env.ts`, con `import "server-only"`): service role,
  Anthropic, OpenAI, Stripe, Mercado Pago, USDA, VAPID privada, `CRON_SECRET`. Un valor vacío cuenta como
  ausente. `integrationStatus()` informa solo booleanos (configurado o no), nunca valores.
- `.env*` está en `.gitignore` (salvo `.env.example`, sin valores).
- **Service role** (`createSupabaseAdminClient()`, `src/lib/supabase/admin.ts`, se salta RLS). Se usa solo así:

| Uso | Dónde | Qué se comprueba antes |
|---|---|---|
| Webhooks de pago | `src/lib/billing/stripe.ts`, `mercadopago.ts` | Firma válida |
| Cancelar y confirmar pago | `src/features/billing/server/manage.ts`, `confirm.ts` | Sesión y que la suscripción o referencia sea de esa persona |
| Eliminar cuenta | `src/app/api/account/delete/route.ts` | Origen, sesión, confirmación `"ELIMINAR"` |
| Recordatorios | `src/app/api/cron/reminders/route.ts` | `Authorization: Bearer CRON_SECRET` comparado en tiempo constante |
| Guardar un producto de Open Food Facts | `src/app/api/foods/barcode/[code]/route.ts` | Sesión, código válido, límites por persona y global |
| Buscar profesional por correo; nombre de quien fijó una meta | `src/features/profile/actions.ts`, `queries.ts` | Sesión (y 10 búsquedas/h para la búsqueda por correo) |
| Usuarios, correos del staff en la auditoría, importación USDA | `src/app/admin/usuarios`, `src/app/admin/auditoria`, `src/features/admin/actions/foods.ts` | `requireRole` |

## 6. Validación de entradas

- **Zod en cada Server Action y route handler** (`schemas.ts` de cada módulo). Las acciones devuelven
  `ActionResult` con `VALIDATION` y errores por campo; las rutas, `400 { error: { code, message } }`.
- **Nunca se confía en ids del cliente**: el `user_id` sale de la sesión; los ids que llegan (plan, receta,
  solicitud de IA) se buscan filtrando por el usuario, y un id ajeno da `NOT_FOUND`.
- **Topes de tamaño y tipo**: imagen ≤ 8 MB con formato real comprobado por sharp (`src/lib/ai/image.ts`),
  audio ≤ 8 MB, texto para IA ≤ 1000, chat ≤ 2000, cuerpo de `/api/errors` ≤ 16 KB.
- **Formatos**: códigos de barras con dígito verificador (`src/lib/foods/barcode.ts`), UUID, fechas ISO
  dentro de lo permitido (diario: pasado y hasta mañana), URL de notificaciones solo internas.
- **Contenido**: el markdown de FAQ y legales se pinta con un parser propio sin
  `dangerouslySetInnerHTML` (`src/features/marketing/markdown.tsx`, `src/features/admin/lib/markdown.tsx`);
  `safeHref` solo acepta `http(s)`, `mailto`, rutas internas y anclas. El JSON-LD se serializa escapando
  `<`, `>`, `&`, U+2028 y U+2029.
- **La base es la segunda línea**: checks de rango (peso 20–400 kg, agua 1–5000 ml, kcal por 100 g ≤ 900…),
  enums y triggers.

## 7. Límites de abuso

`check_rate_limit` (ventana fija) en:

| Bucket | Límite | Dónde |
|---|---|---|
| `foods_search` | 60/min por persona | `GET /api/foods/search` |
| `foods_detail` | 120/min | `GET /api/foods/[id]` |
| `foods_barcode` | 30/min | `GET /api/foods/barcode/[code]` |
| `off_api:global` | 90/min para toda la app | Consultas a Open Food Facts (`src/features/foods/server/barcode-lookup.ts`) |
| `ai_photo` / `ai_text` / `ai_voice` / `ai_chat` | 6 / 12 / 12 / 20 por min | `/api/ai/*` (`AI_RATE_LIMITS`, `src/features/ai/server/http.ts`) |
| `account_export` | 5/h | `GET /api/account/export` |
| `push_subscribe` | 20/h | `POST /api/push/subscribe` |
| `pro_access_lookup` | 10/h | Dar acceso a un profesional por correo |
| `billing:checkout` | 10/h | `POST /api/billing/checkout` |
| `billing:confirm` | 40 cada 10 min | Consultas al proveedor desde `/app/premium/gracias` |
| `error_reports` | 20/h por IP sin sesión, 60/h por persona | Trigger `enforce_error_report_rate_limit` → 429 |

Si el contador falla, las rutas de alimentos, IA, exportación y checkout responden 500 y no dejan pasar.

**Cupos de IA**: `consume_ai_quota` cuenta por persona y mes (en su zona horaria) contra
`plans.ai_monthly_limits`. La semilla trae 0 en el plan gratis y 120 fotos, 300 textos, 300 voces y 400
mensajes de chat en Premium (editables en `/admin/planes`). Sin clave de Anthropic no se consume cupo; el
chat moderado tampoco. La voz grabada y transcrita en el servidor usa 2 del cupo de voz.

## 8. Pagos

- **Nunca pasamos ni guardamos datos de tarjeta.** El pago ocurre en la página del proveedor (Stripe
  Checkout o el `init_point` de Mercado Pago); `payments` guarda montos, estado e ids del proveedor.
- **Firmas**: Stripe con `Stripe.webhooks.constructEvent(cuerpo crudo, stripe-signature,
  STRIPE_WEBHOOK_SECRET)`; firma inválida o ausente → 400 sin registrar nada. Mercado Pago: HMAC-SHA256 de
  `id:{data.id};request-id:{x-request-id};ts:{ts};` con `MERCADOPAGO_WEBHOOK_SECRET`, comparación con
  `timingSafeEqual`, ventana de 24 h, el `data.id` del cuerpo debe coincidir con el firmado, y **siempre**
  se consulta el recurso real a la API antes de guardar.
- **Idempotencia**: `claimBillingEvent` inserta en `billing_events` (único por proveedor + id de evento); un
  duplicado (`23505`) responde 200 sin reprocesar. Si el proceso falla, `releaseBillingEvent` libera el
  evento para que el reintento del proveedor funcione (`src/lib/billing/sync.ts`).
- **Escrituras**: solo con service role. `upsertSubscription` nunca cambia el dueño de una suscripción ni
  revive una cancelada con un evento viejo; `recordPayment` no deja que un fallo tardío pise un pago exitoso.
- **Premium lo da solo la base**: `is_premium()` (trialing/active con fin en el futuro). Un estado
  desconocido del proveedor nunca da acceso (`src/lib/billing/status.ts`).
- **Propiedad**: al confirmar un pago, la referencia del proveedor (`client_reference_id` /
  `external_reference`) debe ser de la persona con sesión.
- Eliminar la cuenta con una suscripción que seguiría cobrando responde 409.
- **No se probó contra Stripe ni Mercado Pago reales** (no hay claves ni red en este entorno): Stripe con
  eventos firmados con `generateTestHeaderString`, Mercado Pago con firma HMAC real y `fetch` simulado.

## 9. IA

- **Consentimiento `ai_processing` vigente** antes de cada llamada (`guardAiRoute` → `hasAiConsent`): sin él,
  403 `CONSENT_REQUIRED`. Se otorga en el onboarding o en la pantalla de IA y se retira en
  `/app/perfil/privacidad`. Orden de la guarda: sesión → función Premium → consentimiento → proveedor configurado.
- **Lo mínimo al proveedor**: la foto re-codificada a JPEG ≤ 1568 px sin metadatos (sin EXIF ni GPS), el
  texto o la transcripción que escribe o dicta la persona. El asistente recibe un contexto mínimo
  (`src/features/assistant/lib/context.ts`): fecha, objetivo declarado, meta y totales de hoy, cupo. Nunca
  nombre, correo, peso, fotos ni condiciones en detalle; ante un bloqueo por riesgo, el modelo recibe solo
  la regla («no propongas déficit»), no el motivo. Historial: últimos 20 mensajes.
- **Moderación previa por reglas** (`src/features/assistant/lib/moderation.ts`, sin IA): autolesión, señales
  de TCA y restricción extrema reciben una respuesta segura fija con recursos de Perú (Línea 113 opción 5,
  SAMU 106), el mensaje queda marcado, **no se llama al modelo ni se consume cupo**. Con antecedente de TCA
  el asistente entra en «modo cuidado» (sin cifras de calorías).
- **Prompts** (`src/lib/ai/prompts.ts`): español de Perú, sin diagnósticos, sin calorías ni nutrientes, e
  ignoran instrucciones que vengan dentro de la foto o del texto.
- **Salida**: esquemas Zod sin campos de nutrientes (`src/lib/ai/schemas.ts`); negativa del modelo →
  `AI_REFUSED`; salida inválida → error, nunca un resultado inventado.
- **Nada se registra sin confirmar**: las rutas `/api/ai/*` no escriben en el diario. Solo
  `confirmAiItemsAction` lo hace, con nutrientes de la base y comprobando que la solicitud sea propia,
  exitosa, del tipo correcto y no registrada antes.
- **Qué se guarda**: en `ai_analysis_requests.output`, lo que propuso la IA y los ids de las coincidencias
  (nunca nutrientes); del audio, solo el largo del texto. El chat guarda pregunta y respuesta en
  `assistant_messages` (la persona puede borrarlas).
- **Proveedores externos**: Anthropic recibe fotos, textos y mensajes; OpenAI recibe audio solo si se
  configura la transcripción en el servidor (`TRANSCRIPTION_PROVIDER=openai`). Las condiciones de
  retención y entrenamiento de cada proveedor están pendientes de documentar en la política (el borrador lo
  marca como `[DETALLAR PROVEEDOR, PAÍS Y CONDICIONES DE NO ENTRENAMIENTO]`).
- **No hubo llamadas reales a Claude ni a OpenAI**: todo se probó con el SDK y `fetch` simulados.

## 10. Protección de datos personales en Perú (Ley N.° 29733 y su reglamento)

La Ley N.° 29733 trata los datos de salud como **datos sensibles**. Lo que la app hace hoy:

### Qué datos tratamos

| Categoría | Dónde | ¿Sensible? |
|---|---|---|
| Cuenta | `auth.users` (correo), `profiles.display_name` | No |
| Perfil para el cálculo | `profiles` (fecha de nacimiento, sexo para el cálculo, estatura, zona horaria) | Sí, en conjunto con lo demás |
| Condiciones declaradas | `user_goals.health_flags` (embarazo, lactancia, antecedente de TCA, diabetes con medicación, enfermedad renal, otra) | **Sí** |
| Registros | diario, agua, peso, % de grasa, medidas, ayunos, ejercicio | **Sí** |
| Fotos | `progress-photos`, `meal-photos` | **Sí** |
| Conversaciones con el asistente | `assistant_messages` | Pueden contener datos de salud |
| Pagos | `subscriptions`, `payments` (sin tarjeta) | No |
| Técnicos | `error_reports` (saneados), `admin_audit_logs` | No |

### Consentimientos versionados
- Tabla `consents` como historial (solo se inserta), con `version` (`CONSENT_VERSION = "2026-10"`,
  `src/features/auth/consents.ts`). Manda la fila más reciente por tipo.
- Al registrarse: términos y privacidad (casilla obligatoria), guardados en `user_metadata` y copiados a
  `consents` al confirmar el correo.
- En el onboarding: términos + privacidad y **datos de salud** obligatorios; este último con texto
  explícito y separado que cita la ley (`HEALTH_DATA_CONSENT_TEXT`). IA y novedades son opcionales. Se
  registran también los no otorgados.

### Revocación
- En `/app/perfil/privacidad`: IA, fotos de progreso y novedades con un interruptor (fila nueva).
- Datos de salud: se retiran con confirmación; se inserta la revocación y `onboarding_completed_at` pasa a
  null, así `/app` queda en pausa hasta volver a autorizar. Los datos no se borran (para eso está eliminar
  la cuenta). Límites de esta pausa en §13.
- Términos y privacidad solo se retiran eliminando la cuenta.
- Acceso de un profesional: la persona lo retira cuando quiere.

### Derechos de acceso, rectificación, cancelación y oposición
| Derecho | Cómo se cubre hoy |
|---|---|
| Acceso | `GET /api/account/export`: JSON descargable con la cuenta, el perfil y todas las tablas propias, más URL firmadas de 1 h de las fotos. Filtra por el id propio aunque la persona sea profesional o admin. Sin ids del proveedor de pagos ni claves de push. Si una sección falla responde 500 (no entrega una copia incompleta). 5 descargas por hora. No incluye `error_reports` |
| Rectificación | Editar datos, metas y cada registro desde la app. No hay cambio de correo |
| Cancelación | `POST /api/account/delete` (ver abajo) |
| Oposición | Retirar consentimientos opcionales o el de salud (al retirar el de salud se pausa el acceso, los profesionales dejan de ver los datos y no llegan recordatorios) |

**Eliminación de cuenta** (`src/features/profile/server/delete-account.ts`): exige origen propio, sesión y
`{ confirm: "ELIMINAR" }`; sin service role responde 503 y no borra nada; con una suscripción que
seguiría cobrando, 409. Luego: 1) borra los archivos de `{uid}/` en `progress-photos`, `meal-photos` y
`recipe-images` (`removeUserFiles`, `src/features/profile/server/storage-files.ts`); 2)
`auth.admin.deleteUser` (todo lo demás cae en cascada; `handle_deleted_user` borra sus recetas y sus
alimentos propios no usados en recetas ajenas); 3) deja en `admin_audit_logs` la acción
`account.deleted_by_user` con el id y la cantidad de archivos borrados (sin correo ni datos de salud).
Probado en `tests/integration/auth-account.test.ts`.

### Datos de salud: medidas adicionales
- Con antecedente de TCA no se muestran números de peso, medidas ni proyecciones.
- Perfiles de riesgo sin déficit automático, sin ayuno y sin planes automáticos (`src/lib/nutrition/risk.ts`).
- Los avisos push no llevan peso ni calorías; el de ayuno solo menciona las horas cumplidas (textos en
  `src/lib/notifications/reminders.ts`).
- El staff no lee registros de salud por RLS (§3.2); el profesional solo con acceso que la persona da.

### Pendientes legales (para revisar con un abogado)
- Publicar términos, privacidad y datos de salud: hoy están en `draft` con marcadores (`[RAZÓN SOCIAL]`,
  `[RUC]`, `[PLAZOS]`, `[EDAD MÍNIMA]`, `[POLÍTICA DE REEMBOLSOS]`, `[JURISDICCIÓN / LIBRO DE
  RECLAMACIONES]`…) en `supabase/seed/00_base.sql`; `/legal/*` muestra «Documento en preparación».
- El borrador de privacidad menciona la inscripción del banco de datos personales ante la Autoridad Nacional
  de Protección de Datos Personales «cuando corresponda» y evaluar el flujo transfronterizo. Los encargados
  que reciben datos: Supabase (la región depende del proyecto que se cree), el hosting, Anthropic, OpenAI
  (opcional), Stripe, Mercado Pago y los servicios push de los navegadores.
- Plazos de conservación; qué hacer con `payments` al eliminar una cuenta (hoy se borran en cascada; el
  comprobante lo emite el proveedor).
- Edad mínima y consentimiento de menores: el onboarding no deja continuar por debajo de 13 años y a los
  13–17 no aplica déficit ni ayuno; falta validar ese criterio contra la norma.

## 11. Cabeceras de seguridad (`next.config.ts`)

Para todas las rutas (`source: "/:path*"`), más `poweredByHeader: false`:

| Cabecera | Valor |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=()` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |

Por ruta: respuestas de API y descargas con `Cache-Control` `no-store`; el plan compartido con `noindex` y
`referrer: no-referrer`; `robots.ts` bloquea `/app`, `/admin`, `/api/`, `/auth/`, `/onboarding` y
`/compartido/`. `images.remotePatterns` solo permite el host de Supabase (`/storage/v1/**`). **No hay
Content-Security-Policy** (§13).

## 12. Registro de errores sin PII

- **Logs del servidor**: códigos, nombres de error e ids, no contenido (`console.error("[diary] … falló",
  error.name)`, `{ code }`, `{ event: event.id }`). Las acciones devuelven mensajes genéricos al usuario.
- **Errores del navegador**: `reportClientError` (`src/features/marketing/report-error.ts`) envía mensaje,
  ruta y `digest` a `POST /api/errors`, que comprueba origen, limita el cuerpo a 16 KB, toma el `user_id`
  de la sesión y sanea (`src/features/marketing/error-report.ts`): quita correos, JWT, `Bearer …`,
  parámetros `token`/`code`/`key`/`password`…, cadenas largas con letras y dígitos y números de 9+ dígitos;
  la ruta pierde query y hash, y tokens/UUID se reemplazan por `[token]`/`[id]`.
- **Auditoría**: `log_admin_action` con ids, códigos y conteos; nunca datos de salud ni valores de configuración.
- `error_reports` solo lo lee el staff y se borra en cascada con la cuenta.

## 13. Riesgos conocidos y pendientes

| # | Riesgo | Detalle | Qué hacer |
|---|---|---|---|
| 1 | Correo de soporte de ejemplo | `app_settings.support_email = "soporte@example.com"` (`supabase/seed/00_base.sql`). Se muestra como contacto y va en el User-Agent hacia Open Food Facts | Cambiarlo en `/admin/configuracion` antes de producción |
| 2 | Textos legales en borrador | Términos, privacidad y datos de salud en `draft` con marcadores; el consentimiento de salud enlaza a esos textos | Revisión de un abogado y publicación desde `/admin/contenidos` |
| 3 | Sin MFA | Ni para usuarios ni para el staff (`[auth.mfa.totp] enroll_enabled = false`) | Activar TOTP al menos para admin y superadmin |
| 4 | Sin CSP y cookies legibles por JS | No hay `Content-Security-Policy`; las cookies de sesión de `@supabase/ssr` no son `httpOnly`. Un XSS podría leer la sesión. Mitigan: React escapa, markdown sin HTML crudo, JSON-LD escapado | Definir una CSP con nonce desde `src/proxy.ts` (guía de Next en `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`); next-themes también inyecta un script inline |
| 5 | Retirar el permiso de salud no bloquea las escrituras propias | **Corregido en parte (2026-10-14):** sin permiso vigente ningún profesional lee ni escribe (`has_professional_access` exige `has_health_consent`, migración `20261014090001`) y el cron no avisa a perfiles en pausa (`onboarding_completed_at` nulo). Sigue abierto: el RLS no mira `consents` para las tablas propias, así que una persona en pausa que llame a la API directamente puede seguir escribiendo sus propios registros (la interfaz la manda a `/onboarding`) | Decidir si las escrituras deben bloquearse también |
| 6 | ~~Superadmin puede crear superadmins por la API~~ | **Corregido (2026-10-14):** las políticas de `user_roles` excluyen `superadmin` en insert, update y delete (migración `20261014090001`); ese rol solo se da o quita por SQL | — |
| 7 | Alcance amplio del staff | Admin lee todos los `profiles`; editor lee alimentos propios y borradores de recetas de cualquiera (§3.2) | Revisar si hace falta; documentarlo en la política |
| 8 | Límite anónimo por IP depende del proxy | `check_rate_limit` usa el primer valor de `x-forwarded-for`; si el hosting no lo fija, se puede falsear | Confirmar el comportamiento del hosting y de Supabase |
| 9 | `rate_limits` crece sin limpieza | No hay tarea que borre claves viejas | Agregar limpieza periódica |
| 10 | Contraseñas y registro | Solo largo ≥ 8; sin captcha; cambiar la contraseña no pide reautenticación; los límites de GoTrue de `config.toml` son locales | Configurarlos en Supabase en la nube; evaluar captcha y `secure_password_change` |
| 11 | Bucket público `recipe-images` | El RLS deja que cualquier usuario suba imágenes a su carpeta (la UI no lo ofrece): alojamiento público de imágenes ≤ 10 MB | Restringir la escritura al staff si no se usa |
| 12 | Catálogo público alimentado por usuarios | Un código de barras nuevo crea un alimento **público** `unverified` desde Open Food Facts (con límites); las marcas que escribe una persona quedan en `brands`, legible por todos | Revisión del staff; aceptar o restringir |
| 13 | Borrador del onboarding en el dispositivo | Antes de crear la cuenta, las respuestas (incluidas condiciones de salud) viven en `localStorage` (`orangefit:onboarding:v1`); se borran al guardar, pero un borrador abandonado queda | Caducarlo y borrarlo pasado el plazo |
| 14 | Límites de la eliminación de cuenta | `removeUserFiles` recorre hasta 20 000 archivos y 6 niveles por bucket; `payments` se borra en cascada; la auditoría conserva el id | Aceptable hoy; revisar con el criterio legal de conservación |
| 15 | HSTS con `preload` e `includeSubDomains` | Obliga HTTPS en todos los subdominios del dominio final | Confirmar antes de enviar el dominio a la lista de precarga |
| 16 | Integraciones no probadas en real | Anthropic, OpenAI, Stripe, Mercado Pago, USDA, VAPID y Google solo con simulaciones; Open Food Facts solo devolvió 502 (sin red) | Probar en un entorno con claves de prueba antes de abrir |
| 17 | Moderación simple | Lista de expresiones; no reemplaza una revisión clínica | Revisar con un profesional de salud |
| 18 | `error.message` en algunos logs | Rutas de alimentos, código de barras y pagos registran el mensaje técnico (de la base, la red o el proveedor), no contenido del usuario | Verificar que esos mensajes no traigan datos personales |
| 19 | Sesiones | Cerrar sesión solo cierra el dispositivo actual; no hay cambio de correo | Agregar «cerrar en todos» (`scope: "global"`) y cambio de correo si se necesita |
