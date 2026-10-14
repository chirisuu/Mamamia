# Módulo auth — autenticación, onboarding, perfil, consentimientos y cuenta

Dueño de: `src/app/(auth)/*`, `src/app/auth/*`, `src/app/onboarding`, `src/app/app/perfil` (salvo
`suscripcion`, que es de pagos), `src/app/api/account/*`, `src/features/{auth,onboarding,profile}`.

## Qué quedó funcional

### Ingreso y registro (`src/app/(auth)`, cliente de navegador de Supabase)
| Ruta | Qué hace |
|---|---|
| `/ingresar` | Correo + contraseña (RHF + Zod). Respeta `?next=` (saneado con `safeNext`: solo rutas internas, nunca `//`, `https:`, ni volver a pantallas de ingreso). Con sesión redirige a `next`. Errores en español por `code` de Supabase: credenciales inválidas, correo sin verificar (con botón «Reenviar correo»), demasiados intentos (429), sin conexión. `?error=oauth` muestra el fallo de Google. |
| `/registro` | Nombre, correo, contraseña (≥ 8, máx. 72 por bcrypt) y casilla obligatoria de Términos y Privacidad (enlaces a `/legal/terminos` y `/legal/privacidad`). `signUp` con `emailRedirectTo = {siteUrl}/auth/confirm?next=…` y metadatos `display_name` + `signup_consents {version, terms, privacy, accepted_at}`. `?from=onboarding` cambia los textos, precarga el nombre del borrador y manda a `/onboarding` tras confirmar. |
| `/verificar` | «Revisa tu correo», reenvío con espera de 60 s (`auth.resend`). El correo llega por `sessionStorage` (no en la URL). `?error=enlace` explica que el enlace venció. |
| `/recuperar` | `resetPasswordForEmail` con `redirectTo = {siteUrl}/auth/confirm?next=/nueva-clave`. Respuesta neutra (no revela si existe la cuenta). |
| `/nueva-clave` | Requiere la sesión que abre el enlace (o una sesión normal: sirve para cambiar la contraseña desde Datos). `updateUser({ password })`. Sin sesión: estado vacío con enlace a pedir otro. |

Route handlers:
- `GET /auth/confirm`: `verifyOtp({ type, token_hash })` **o**, si llega `?code=` (plantilla por defecto de
  Supabase con PKCE), `exchangeCodeForSession`. Luego copia la aceptación de `user_metadata.signup_consents`
  a `consents` (idempotente, `recordSignupConsents`) y redirige a `next` (recuperación → `/nueva-clave`).
  Si falla: `/verificar?error=enlace` o `/recuperar?error=enlace`.
- `GET /auth/callback`: OAuth (Google), `exchangeCodeForSession` y `next`.
- `POST /auth/salir`: `signOut({ scope: "local" })`, comprobación de origen (Origin = Host) y 303 a `/`.

Las llamadas a Supabase Auth salen **del navegador** a propósito: así el límite por IP de GoTrue
(`sign_in_sign_ups`, `email_sent`) se aplica a la IP real y no a la del servidor de Next.

### Onboarding (`/onboarding`)
- Asistente de 21 pantallas (una pregunta por pantalla), barra de avance, botón grande fijo abajo, foco
  al título en cada paso, animación corta con `motion` (respeta movimiento reducido vía `MotionConfig`).
- Funciona **sin sesión**: borrador en `localStorage` clave `orangefit:onboarding:v1` (validado campo a
  campo al cargar; lo inválido se descarta). Con sesión precarga perfil + objetivo + último peso.
- Preguntas: nombre; fecha de nacimiento (edad visible; < 13 bloquea; 13–17 avisa: sin déficit ni
  ayuno); sexo para el cálculo (explica que solo cambia la constante de Mifflin-St Jeor); estatura; peso;
  peso objetivo (opcional; aviso amable si su IMC < 18.5); actividad (textos de `activity.ts`); sesiones
  de entrenamiento; objetivo (5 `goal_type`); ritmo (solo bajar/subir: 0.25/0.5/0.75/1 % del peso por
  semana para bajar, 0.25/0.5 % para subir; con perfil de precaución se deshabilita > 0.5 % con el motivo;
  si el déficit ya está bloqueado por edad o IMC se explica y no se pide); patrón de alimentación; alergias
  e intolerancias (códigos de `recipes.allergens`: gluten, lactosa, huevo, pescado, mariscos, mani,
  frutos_secos, soya, sesamo + otra libre); restricciones y alimentos que no gustan; país y moneda
  (Perú/PEN por defecto); presupuesto semanal (o «prefiero no indicarlo»); comidas por día; experiencia;
  condiciones de salud (6 `health_flags` + «ninguna», con texto empático para TCA).
- Resultado (`computePlan` → `computeTargets` + `screenRisk`): kcal, macros con % de energía, fibra,
  agua, TMB, gasto y ajuste; «Cómo lo calculamos» (pasos con fórmula y valores), supuestos y fuentes,
  avisos (`warnings`), mensajes del cribado (`risk.messages`) y la aclaración de que no reemplaza a un
  profesional. Con `risk.level === "professional"` las metas se calculan en **mantenimiento** aunque el
  objetivo sea bajar/subir/recomponer (se guarda el objetivo elegido), `requires_professional_review = true`
  y se sugiere acompañamiento sin bloquear el uso básico.
- Consentimientos versión `2026-10`: términos+privacidad (obligatorio), datos de salud (obligatorio,
  texto explícito y separado citando la Ley N.° 29733), IA (opcional), novedades (opcional). Se registran
  también los no otorgados.
- Sin sesión: «Crea tu cuenta para guardar tu plan» → `/registro?from=onboarding` (o «Ya tengo cuenta»),
  dejando el borrador en `stage = awaiting_account`. Al volver con sesión, si el borrador está completo,
  tiene los permisos y es de los últimos 7 días, se guarda solo («Guardando tu plan en tu cuenta …»);
  si falla, se puede revisar.
- `completeOnboarding` (server action) → `saveOnboarding(supabase, userId, submission)`: valida con Zod,
  zona horaria del navegador con `isValidTimeZone` (si Postgres no la conoce, 22023 → America/Lima),
  recalcula todo en el servidor, y escribe en este orden: `profiles` (sin completar) → `consents` →
  desactiva objetivos previos → `user_goals` activo → `nutrition_targets` (hoy en su zona, `source auto`,
  `method mifflin_st_jeor`, `inputs` con entrada, resultado, pasos, supuestos, avisos y cribado) →
  `weight_logs` (upsert del día) → `onboarding_completed_at` (solo la primera vez). Sin transacción: un
  fallo a medias deja el onboarding sin completar y reintentarlo es seguro. Redirige a `/app`.
- `?rehacer=1` (desde Metas): rehacer el cuestionario con sesión y onboarding completo (nuevo objetivo y
  meta; conserva la fecha de onboarding).
- Si la persona retiró el permiso de datos de salud: `/onboarding` muestra solo «Tu acceso está en
  pausa» con volver a autorizar (`grantHealthConsentAgain`), descargar datos, eliminar cuenta o salir.

### Perfil (`/app/perfil/*`)
- Centro: tarjeta con nombre, correo y plan (Gratis/Premium); Datos, Metas, Privacidad, Suscripción
  (`/app/perfil/suscripcion`, de pagos), Acceso profesional; tema (ThemeToggle); «Instalar app» solo si
  el navegador lo ofrece (`beforeinstallprompt`) o instrucciones en iPhone/iPad; cerrar sesión; legales.
- Datos: nombre, nacimiento (13–100), sexo para el cálculo, estatura, país, moneda, zona horaria,
  «sumar calorías del ejercicio» (explica el doble conteo). Enlace a cambiar contraseña.
- Metas: meta vigente con origen («Calculada automáticamente», «Ajuste manual», «Fijada por {nombre}») y
  su explicación guardada en `inputs`; metas programadas a futuro; objetivo activo; «Recalcular con tu
  peso más reciente» (vista previa + guardar); ajuste manual con revisión en vivo
  (`reviewManualTargets`): **bloquea** bajo 1200/1500 kcal (1500 si no hay sexo) y bajo el gasto si el
  cribado bloquea el déficit; **avisa** (y pide confirmar) bajo la TMB, déficit > 25 %, superávit > 20 %
  (> 10 % con precaución) y macros que no cuadran (±10 %); historial.
- Profesional (rol `professional`): lista de personas que le dieron acceso →
  `/app/perfil/profesional/pacientes/[userId]` (todo vía RLS): meta vigente, objetivo, TMB/gasto, 7 días de
  totales, pesajes, historial y «Fijar una meta» (`source professional`, `created_by` = profesional,
  fecha de inicio ≥ hoy; para el profesional los bloqueos son avisos a confirmar).
- Privacidad: estado e historial de versión de cada consentimiento; IA, fotos de progreso y novedades se
  otorgan/retiran con un switch; términos/privacidad solo se retiran eliminando la cuenta; datos de salud
  se pueden retirar con confirmación: inserta la revocación y pone `onboarding_completed_at = null`
  (el layout de `/app` lleva a `/onboarding`, que pide volver a autorizar). Descarga de datos y
  eliminación de cuenta.
- Acceso profesional: dar acceso por correo (busca con el cliente admin una cuenta con rol `professional`;
  un correo sin ese rol responde igual que uno inexistente; límite de 10 búsquedas/h por persona con
  `check_rate_limit`), alcance «Solo ver» o «Ver y ajustar metas», lista vigente con «Retirar» y accesos
  anteriores.

### API
- `GET /api/account/export`: JSON descargable (`Content-Disposition: attachment`, `no-store`) con
  cuenta (id, correo, fechas), `profile` y todas las tablas propias paginadas de 1000 en 1000 (roles,
  consentimientos, objetivos, metas, comidas e ítems, plantillas, favoritos, recetas + ingredientes,
  alimentos propios + porciones + micronutrientes, planes, listas, agua, peso, medidas, fotos, ayuno,
  ejercicio, conversaciones y mensajes del asistente, solicitudes de IA, notificaciones, insignias, retos,
  suscripciones y pagos **sin ids del proveedor**, push sin claves), accesos profesionales dados/recibidos
  (sin ids ajenos), y `files` con URL firmadas de 1 h (progreso y comidas) o públicas (recetas). Cada
  consulta filtra por el id propio (RLS de profesional/admin podría mostrar filas ajenas). Si una sección
  falla responde 500 (no entrega una copia incompleta). 401 sin sesión; 429 tras 5 descargas/h.
- `POST /api/account/delete` (`{ confirm: "ELIMINAR" }`): origen comprobado; 401 sin sesión; 400 sin la
  confirmación; **503** sin `SUPABASE_SERVICE_ROLE_KEY`; **409** si hay una suscripción trialing/active/
  past_due sin `cancel_at_period_end` (seguiría cobrando); borra `{uid}/…` en `progress-photos`,
  `meal-photos` y `recipe-images`, luego `auth.admin.deleteUser` (cascada), registra
  `account.deleted_by_user` en `admin_audit_logs` con `{files_removed}` (sin correo ni datos de salud) y
  borra las cookies.

## Requiere credenciales o configuración
- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`): sin ellas las pantallas
  muestran `SetupRequired`.
- **`SUPABASE_SERVICE_ROLE_KEY`**: eliminar cuenta (sin ella 503) y buscar profesionales por correo /
  mostrar el nombre de quien fijó una meta (sin ella la UI dice «pendiente de configurar» y muestra
  «tu profesional»).
- **Correo**: en local llega a Mailpit (`http://127.0.0.1:54324`). En producción hace falta SMTP en
  Supabase Auth.
- **Google**: el botón aparece solo con `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`. Para activarlo:
  1) en Google Cloud crea un cliente OAuth «Aplicación web» con URI de redirección
  `{SUPABASE_URL}/auth/v1/callback`; 2) en Supabase activa el proveedor Google con ese client id/secret
  (local: `[auth.external.google] enabled = true`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`,
  `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`); 3) agrega `{siteUrl}/auth/callback` a las URL de redirección
  permitidas (en local ya está en `additional_redirect_urls`); 4) define la variable y reconstruye.

## Configuración compartida aplicada en la integración
- Plantillas de correo en `supabase/templates/` con `token_hash`, para que el enlace funcione aunque se
  abra en otro navegador: `{{ .SiteURL }}/auth/confirm?token_hash=…&type=email&redirect_to={{ .RedirectTo }}`
  (confirmación) y `…&type=recovery` (recuperación). `/auth/confirm` toma `next` de `redirect_to`. Se usa
  `SiteURL` y no `RedirectTo` como base porque, si la URL de retorno no está permitida, GoTrue la cambia
  por la URL del sitio (sin `?`) y el enlace quedaría roto. En producción hay que copiarlas al panel.
- `minimum_password_length = 8` en `supabase/config.toml` (la app ya exigía 8).

## Qué falta / límites conocidos
- No hay cambio de correo ni MFA.
- La búsqueda de profesionales recorre las cuentas con rol `professional` (directo hasta 50; luego
  `listUsers` paginado): suficiente para cientos, no para decenas de miles.
- Cuando su profesional fija o cambia una meta, la persona recibe un aviso en la app: lo crea el trigger
  `nutrition_targets_professional_notice` (migración `20261013110001`), porque con RLS el profesional no
  puede escribir notificaciones ajenas.
- El export no incluye `error_reports` (solo los lee el staff); se borran en cascada con la cuenta.
- Retirar el consentimiento de IA queda registrado y la API de IA lo respeta: responde 403 `CONSENT_REQUIRED`
  (`src/features/ai/server/http.ts`).

## Pruebas
- Unitarias: `src/features/auth/auth.test.ts`, `src/features/onboarding/onboarding.test.ts`,
  `src/features/profile/manual-targets.test.ts`; UI (jsdom): `src/features/onboarding/components/wizard.test.tsx`
  (recorre las 21 pantallas), `src/features/auth/components/auth-forms.test.tsx`.
- Integración (Supabase local): `tests/integration/auth-onboarding.test.ts`, `auth-account.test.ts`
  (export solo con datos propios aunque la persona sea profesional con acceso a otra; eliminación borra
  archivos, usuario y deja auditoría; 409 con suscripción activa), `auth-signup.test.ts` (signUp real,
  correo en Mailpit, confirmación, consentimientos desde metadatos, recuperación con PKCE),
  `auth-professional.test.ts`.
