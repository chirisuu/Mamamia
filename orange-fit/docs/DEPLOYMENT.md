# Puesta en producción — ORANGE FIT con Supabase (nube) y Vercel

Guía paso a paso, en orden, para publicar ORANGE FIT. Está pensada para quien emprende y no es
especialista: cada paso dice qué hacer, dónde y cómo comprobar que salió bien.

Antes de empezar, ten claro esto:

- **Lo probado y lo no probado.** Todo el código está implementado y probado (lint, typecheck,
  pruebas unitarias, de integración contra un Supabase local y E2E). Pero las integraciones externas
  **no se probaron contra el proveedor real**, porque el entorno de desarrollo no tenía sus claves:
  Anthropic (IA), Stripe, Mercado Pago, USDA, VAPID (push) y Google. Se probaron con simulaciones y
  con firmas generadas en local. La primera vez que conectes cada una, haz la prueba de la sección 10.
- **Sin clave, la app no finge.** Si falta una credencial, la pantalla dice «pendiente de configurar»
  y la API responde 503. Nunca devuelve un resultado inventado.
- Los nombres de menús de los paneles de Supabase, Vercel, Stripe, Mercado Pago y Google cambian con
  el tiempo. Donde no es seguro el nombre exacto, la guía lo describe de forma general.

Rutas de archivo relativas a la carpeta `orange-fit/` del repositorio.

---

## 1. Requisitos y cuentas

### Cuentas

| Servicio | ¿Obligatorio? | Para qué | Nota |
|---|---|---|---|
| GitHub | Sí | Guardar el código y conectarlo a Vercel | El repo es `chirisuu/Mamamia`; la app vive en la carpeta `orange-fit/` |
| Supabase | Sí | Base de datos, cuentas (Auth) y archivos (Storage) | En el plan gratuito los proyectos se pausan si no hay actividad y los respaldos son limitados: revisa las condiciones vigentes antes de abrir al público |
| Vercel | Sí | Publicar la web | Los términos de Vercel reservan el plan Hobby para uso personal no comercial. Como vas a cobrar suscripciones, revisa sus condiciones: lo normal es usar Pro |
| Dominio propio | Muy recomendado | URL definitiva (p. ej. `tudominio.pe`) | De él dependen correos, pagos, OAuth y webhooks |
| Proveedor de correo SMTP | Sí, para producción | Enviar correos de confirmación y recuperación | El correo incluido en Supabase sirve solo para pruebas |
| Anthropic | Opcional | Registro por foto, voz y texto, y asistente | Sin clave, la IA queda «pendiente de configurar» |
| Stripe | Opcional | Cobro con tarjeta internacional (en dólares) | Confirma en la web de Stripe que tu empresa puede abrir una cuenta desde su país |
| Mercado Pago | Opcional | Cobro en soles (PEN) | Viene apagado en la semilla |
| Google Cloud | Opcional | Botón «Continuar con Google» | |
| USDA FoodData Central | Opcional | Importar alimentos desde `/admin/alimentos/importar` | Clave gratuita |
| OpenAI | Opcional | Transcribir audio en el servidor | Sin ella, la voz usa el dictado del navegador |
| Servicio de cron externo | Solo si tu plan de Vercel no permite la frecuencia que quieres | Disparar los recordatorios | Ver sección 8 |

Si no vas a cobrar todavía, puedes publicar solo con Supabase + Vercel + SMTP: cuentas, onboarding,
diario, alimentos, recetas, plan, compras, seguimiento, logros, landing y panel admin funcionan sin
nada más (ver `README.md`).

### En tu computadora

- Node 22 o superior y Git (el `README.md` pide Node 22+).
- Una terminal. Los comandos de esta guía se corren dentro de `orange-fit/`.
- Docker Desktop solo para desarrollo local y para `supabase db dump` (respaldos, sección 11).
- `psql` (cliente de PostgreSQL) es opcional: sirve para cargar semillas desde la terminal.

### Decide el dominio antes de empezar

La URL pública se usa en muchos lugares: `NEXT_PUBLIC_SITE_URL`, la configuración de Auth de
Supabase, los webhooks de Stripe y Mercado Pago, las URL de retorno de los pagos y el cliente de
Google. Si todavía no tienes dominio, puedes hacer todo con la URL `https://<proyecto>.vercel.app`
que te da Vercel y cambiarla después (la sección 3.5 dice qué actualizar).

### Dónde guardar los secretos

Guarda cada clave en un gestor de contraseñas. **Nunca** las subas al repositorio: `.gitignore` ya
ignora `.env*` (salvo `.env.example`).

---

## 2. Supabase

### 2.1 Crear el proyecto

1. En el panel de Supabase, crea un proyecto nuevo.
2. **Región:** elige la más cercana a Perú. Hoy es South America (São Paulo).
3. **Contraseña de la base:** genera una fuerte y guárdala. La vas a necesitar para `supabase link`.
4. Anota el **Project ref**: es el código de 20 letras que aparece en la URL del proyecto
   (`https://<ref>.supabase.co`).

> Ley N.° 29733: tus datos (incluidos datos de salud) quedarán en un servidor fuera del Perú.
> Consulta con tu abogado las obligaciones que eso implica (por ejemplo, flujo transfronterizo e
> inscripción del banco de datos personales).

### 2.2 Aplicar las migraciones

Las migraciones crean todo el esquema: tablas, RLS, funciones, triggers y buckets de Storage. Son 14
archivos en `supabase/migrations/` y se aplican en orden.

```bash
cd orange-fit
npm install                                   # instala también el CLI de Supabase (devDependency)
npx supabase login                            # abre el navegador para autorizar el CLI
npx supabase link --project-ref <ref>         # te pide la contraseña de la base
npx supabase db push --dry-run                # muestra qué migraciones aplicaría, sin tocar nada
npx supabase db push                          # aplica las migraciones
npx supabase migration list --linked          # comprueba: local y remoto deben coincidir
```

Qué crean (para que sepas qué buscar en el panel):

| Migración | Contenido |
|---|---|
| `20261013000001_extensions_enums_helpers.sql` | Extensiones `pg_trgm` y `unaccent`, enums y funciones auxiliares |
| `…000002` a `…000008` | Tablas de usuarios, alimentos, recetas, diario, planes, seguimiento, IA, notificaciones, pagos y administración |
| `…000009_functions.sql` | Funciones (`has_role`, `is_premium`, `consume_ai_quota`, `admin_metrics`…) |
| `…000010_rls.sql` | Políticas RLS de todas las tablas |
| `…000011_storage.sql` | Buckets de Storage y sus políticas |
| `…000012_grants.sql` | Permisos |
| `20261013100801_admin_panel.sql` | Funciones del panel (`admin_ai_usage`, `admin_merge_foods`) y aviso de revisión de recetas |
| `20261013110001_integration_professional_target_notice.sql` | Aviso a la persona cuando su profesional cambia su meta |

Lo que **no** debes hacer contra producción:

- `npx supabase db reset --linked`: **borra toda la base** remota.
- `npx supabase config push`: `supabase/config.toml` tiene valores de desarrollo (`site_url =
  "http://localhost:3000"`, redirecciones a `localhost`, Google apagado). Subirlo pisaría tu
  configuración de producción. Configura Auth desde el panel (sección 2.4).

### 2.3 Semillas (datos iniciales)

`supabase db push` **no** carga las semillas. Están en `supabase/seed/` y se aplican aparte. Esto es
lo que trae cada una y qué te recomendamos:

| Archivo | Qué trae | ¿En producción? | Qué revisar |
|---|---|---|---|
| `00_base.sql` | Planes `free` y `premium` con cupos de IA, 4 precios de Premium (PEN 29.90/mes y 199.90/año; USD 7.99/mes y 54.99/año; 7 días de prueba), `app_settings` (nombre, correo de soporte, interruptores, días de prueba, aviso de mantenimiento), micronutrientes, insignias, retos, 10 preguntas frecuentes publicadas y los 3 textos legales **en borrador** | **Sí, obligatorio.** Sin planes ni ajustes la app no funciona bien | Precios: son valores de referencia, cámbialos en `/admin/planes`. `support_email` viene como `soporte@example.com`: cámbialo (sección 10). `payments_mercadopago` viene en `false` |
| `10_foods.sql` | 196 alimentos peruanos y latinoamericanos con 276 porciones. Públicos, `source = 'curated'`, **todos `unverified`**: son valores aproximados | Recomendado (sin él, la búsqueda de alimentos empieza vacía). Decisión tuya | Revísalos en `/admin/alimentos/verificacion`. El método y las fuentes están en `docs/DATA_SOURCES.md` |
| `20_recipes.sql` | 36 recetas oficiales publicadas, sin imagen. Necesita `10_foods.sql` | Recomendado (el planificador y las recetas lo necesitan). Decisión tuya | Falta la revisión de un profesional (`reviewed_by` vacío). Las imágenes se suben desde `/admin/recetas` |
| `30_reference_prices.sql` | 79 precios referenciales de Lima en soles. Necesita `10_foods.sql` | Opcional | **Sin fuente verificada** (lo dice cada fila). Actualízalos en `/admin/alimentos/precios` antes de confiar en los costos de recetas y listas de compras |

Cómo cargarlas, en este orden: `00_base` → `10_foods` → `20_recipes` → `30_reference_prices`.

**Opción A — con `psql`** (recomendada). Copia la cadena de conexión (URI) que muestra el panel de
Supabase en la sección de conexión a la base de datos y reemplaza la contraseña:

```bash
export DATABASE_URL='postgresql://…'          # la URI de tu proyecto
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/00_base.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/10_foods.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/20_recipes.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/30_reference_prices.sql   # opcional
```

**Opción B — editor SQL del panel.** Abre cada archivo, copia todo el contenido, pégalo en el editor
SQL de Supabase y ejecútalo. Los archivos 10, 20 y 30 pesan entre 20 y 130 KB.

**Opción C — todo de una vez:** `npx supabase db push --include-seed` carga los cuatro archivos
(incluidos los alimentos y precios sin verificar). Úsala solo si estás de acuerdo con cargar todo.

Cosas que conviene saber:

- `10_foods`, `20_recipes` y `30_reference_prices` **no se duplican**: si ya se cargaron, abortan sin
  escribir nada.
- `00_base.sql` se puede volver a correr, **pero** reescribe nombre, descripción, funciones y cupos de
  IA de los planes (`on conflict … do update`). Si ya los editaste en `/admin/planes`, no lo vuelvas a
  correr. Los ajustes, precios y contenidos no se pisan (`do nothing`).

### 2.4 Auth (cuentas y correos)

En el panel de Supabase, sección **Authentication**:

**URL de la app** (suele llamarse *URL Configuration*):

| Campo | Valor |
|---|---|
| Site URL | `https://tudominio.pe` (sin barra al final: las plantillas arman `{{ .SiteURL }}/auth/confirm`) |
| Redirect URLs | `https://tudominio.pe/auth/confirm` y `https://tudominio.pe/auth/callback` |

La app agrega `?next=…` a esas URL (`src/features/auth/redirect.ts`). Supabase acepta comodines en
esta lista (por ejemplo `https://tudominio.pe/auth/**`) si necesitas cubrir variantes. En local estas
mismas rutas están en `additional_redirect_urls` de `supabase/config.toml`.

**Proveedor de correo (Email):**

- Activa la **confirmación de correo** (en local: `enable_confirmations = true`). Sin confirmar, la
  persona no puede ingresar.
- **Largo mínimo de contraseña: 8** (en local: `minimum_password_length = 8`). La app ya exige
  entre 8 y 72 caracteres en `/registro`.
- Revisa que el enlace del correo venza en **1 hora** (3600 s, como `otp_expiry` en local): las
  plantillas dicen «El enlace vence en 1 hora».

**SMTP propio (obligatorio para producción).** El correo incluido de Supabase es para pruebas y
tiene límites muy bajos. Contrata un proveedor de correo transaccional y, en la configuración de SMTP
de Auth, carga host, puerto, usuario, contraseña, remitente (p. ej. `no-responder@tudominio.pe`) y
nombre del remitente. Verifica tu dominio en el proveedor (registros SPF y DKIM) para no caer en spam.
Luego revisa los **límites de envío de correo** de Auth y súbelos según tu volumen.

**Plantillas de correo.** Copia el HTML de `supabase/templates/` al panel (sección de plantillas de
correo de Auth):

| Plantilla en el panel | Archivo | Asunto |
|---|---|---|
| Confirmación de registro (*Confirm signup*) | `supabase/templates/confirmation.html` | Confirma tu correo |
| Recuperar contraseña (*Reset password*) | `supabase/templates/recovery.html` | Crea una contraseña nueva |

Por qué importa: estas plantillas usan `token_hash`, así el enlace funciona aunque la persona abra el
correo en otro navegador o en el celular (`src/app/auth/confirm/route.ts`). Con la plantilla por
defecto de Supabase, el enlace falla en ese caso. Si cambias el nombre de la app, cambia también el
texto «ORANGE FIT» que aparece arriba en ambas plantillas.

### 2.5 Storage

No crees buckets a mano: la migración `20261013000011_storage.sql` crea tres. Comprueba en el panel
(sección Storage) que existan:

| Bucket | Público | Límite | Uso |
|---|---|---|---|
| `progress-photos` | No (URL firmada) | 10 MB, solo imágenes | Fotos de progreso, carpeta `{user_id}/` |
| `meal-photos` | No (URL firmada) | 10 MB, solo imágenes | Fotos de comidas que la persona decide guardar |
| `recipe-images` | Sí | 10 MB, solo imágenes | Imágenes de recetas (`official/{slug}.webp`) |

Los archivos de una cuenta no se borran solos con la base: los borra `POST /api/account/delete`
(necesita la clave de servicio, sección 3.3).

### 2.6 Claves que vas a copiar a Vercel

En la configuración del proyecto (sección de API / API Keys):

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`.
- **Clave pública** (*anon* o *publishable*) → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (también se acepta
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, ver `src/lib/env.ts`).
- **Clave de servicio** (*service_role* o *secret*) → `SUPABASE_SERVICE_ROLE_KEY` (también se acepta
  `SUPABASE_SECRET_KEY`, ver `src/lib/server-env.ts`). Se salta RLS: **nunca** le pongas prefijo
  `NEXT_PUBLIC_` ni la compartas.

### 2.7 Primer superadmin

Hazlo **después** de la sección 3, cuando ya te hayas registrado en la app publicada y confirmado tu
correo. En el editor SQL de Supabase:

```sql
insert into public.user_roles (user_id, role)
select id, 'superadmin' from auth.users where email = 'tu@correo.com';
```

Luego entra a `/admin`. Desde `/admin/usuarios` el superadmin puede dar los roles `editor`, `admin` y
`professional`. El rol `superadmin` solo se da por SQL. Una cuenta sin rol que entre a `/admin` ve una
página 404 (no se revela que el panel existe).

---

## 3. Vercel

### 3.1 Importar el repositorio

1. En Vercel, crea un proyecto nuevo e importa el repositorio de GitHub.
2. **Root Directory: `orange-fit`.** Es lo más importante: la app no está en la raíz del repo.
3. Framework: Next.js (Vercel lo detecta). Comandos de instalación y build: los de siempre
   (`npm install`, `npm run build` → `next build`). No hace falta cambiarlos.
4. Versión de Node: elige 22.x en la configuración del proyecto.
5. **Rama de producción.** Vercel publica en producción la rama configurada como tal (por defecto, la
   rama principal del repo). Hoy el código vive en `claude/orange-fit` (ver `README.md`): fusiónala a
   tu rama principal o cambia la rama de producción en la configuración Git del proyecto.
6. Antes del primer despliegue, carga las variables de la sección 3.2.

### 3.2 Variables de entorno

Cárgalas en la configuración del proyecto, en el entorno **Production**. Reglas:

- Las `NEXT_PUBLIC_*` se incrustan en el código **al compilar**. Si cambias una, tienes que volver a
  desplegar.
- En Vercel, cualquier cambio de variable se aplica recién en el **siguiente despliegue**. Después de
  cambiar algo, usa *Redeploy*.
- Si Vercel te ofrece marcar una variable como sensible, hazlo con todas las claves secretas.
- Un valor mal escrito puede tumbar más de lo que parece:
  - `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SITE_URL` deben ser URL válidas (`src/lib/env.ts`). Si
    no, falla la validación al arrancar y se cae toda la app.
  - `CRON_SECRET` debe tener **16 caracteres o más** y `TRANSCRIPTION_PROVIDER` solo acepta `none` u
    `openai` (`src/lib/server-env.ts`). Si no, se caen todas las funciones del servidor que leen esas
    variables (IA, pagos, cron, admin, eliminar cuenta).

| Variable | ¿Obligatoria? | De dónde sale | Si falta |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **Sí** | Tu URL pública con `https`, sin barra final (p. ej. `https://tudominio.pe`) | Usa `http://localhost:3000`: enlaces de correo, Google, URL de retorno de pagos, sitemap y metadatos apuntan a localhost. Mercado Pago rechaza la URL de retorno sin `https` |
| `NEXT_PUBLIC_APP_NAME` | No | Texto libre | Usa «ORANGE FIT». El nombre vigente se lee de `app_settings` (se cambia en `/admin/configuracion`); esta variable es el valor por defecto |
| `NEXT_PUBLIC_SUPABASE_URL` | **Sí** | Supabase → Project URL | Las pantallas muestran «pendiente de configurar» (`src/components/setup-required.tsx`): no hay cuentas ni datos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) | **Sí** | Supabase → clave pública | Igual que la anterior |
| `SUPABASE_SERVICE_ROLE_KEY` (o `SUPABASE_SECRET_KEY`) | **Sí en la práctica** | Supabase → clave de servicio | Responden 503: eliminar cuenta, webhooks de pago, cancelar/confirmar pagos, cron, importación USDA, guardar productos de Open Food Facts, lista de usuarios del admin. La auditoría muestra ids en vez de correos |
| `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED` | No | `true` o `false` | Sin `true` no aparece el botón de Google |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | **No en Vercel** | — | Solo las lee `supabase/config.toml` en local. La app no las usa: el ID y el secreto de Google se cargan en el panel de Supabase (sección 4) |
| `ANTHROPIC_API_KEY` | No | Consola de Anthropic | IA «pendiente de configurar»; `/api/ai/*` responde 503 `AI_NOT_CONFIGURED` |
| `AI_MODEL_VISION`, `AI_MODEL_TEXT`, `AI_MODEL_CHAT` | No | IDs de modelo (sección 5) | Usan `claude-opus-5-5` |
| `TRANSCRIPTION_PROVIDER` | No | `none` u `openai` | `none`: la voz usa el dictado del navegador |
| `OPENAI_API_KEY` | No | Cuenta de OpenAI | Sin ella (o con `none`), `/api/ai/transcribe` responde 503 `TRANSCRIPTION_NOT_CONFIGURED` |
| `OPENAI_TRANSCRIPTION_MODEL` | No | ID de modelo de OpenAI | Usa `whisper-1` (`src/lib/ai/transcription.ts`) |
| `STRIPE_SECRET_KEY` | No | Panel de Stripe → claves de API | Stripe «pendiente de configurar»; checkout responde 503 `BILLING_NOT_CONFIGURED`. Hacen falta **las dos** variables de Stripe |
| `STRIPE_WEBHOOK_SECRET` | No | Panel de Stripe → endpoint del webhook (`whsec_…`) | Igual; el webhook responde 503 |
| `MERCADOPAGO_ACCESS_TOKEN` | No | Panel de desarrolladores de Mercado Pago → credenciales | Mercado Pago «pendiente de configurar». Hacen falta **las dos** variables |
| `MERCADOPAGO_WEBHOOK_SECRET` | No | Panel de Mercado Pago → clave secreta de los webhooks | Igual; el webhook responde 503 |
| `FDC_API_KEY` | No | api.data.gov | La importación USDA dice «pendiente de configurar» |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | `npx web-push generate-vapid-keys` | Sin las tres variables de VAPID, no hay push: los avisos quedan dentro de la app |
| `VAPID_PRIVATE_KEY` | No | El mismo comando | Igual |
| `VAPID_SUBJECT` | No | `mailto:soporte@tudominio.pe` o una URL `https:` | Igual |
| `CRON_SECRET` | No (sí para recordatorios) | `openssl rand -hex 32` (mínimo 16 caracteres) | `/api/cron/reminders` responde 503 y la pantalla de notificaciones lo avisa |
| `NEXT_PUBLIC_ENABLE_SW` | No | — | No la definas en producción: el service worker ya se registra en producción. Solo sirve en desarrollo |

El panel `/admin` muestra el estado de cada integración (configurada o pendiente) sin enseñar los
valores (`integrationStatus()` en `src/lib/server-env.ts`).

### 3.3 Primer despliegue y comprobación rápida

1. Despliega. Si el build falla, revisa el registro del build en Vercel.
2. Abre la URL de producción: debe cargar la portada.
3. Abre `/precios`: debe mostrar los precios de la semilla. Si dice que no se pudieron cargar, revisa
   las variables de Supabase y que las migraciones y `00_base.sql` estén aplicadas.
4. Regístrate con tu correo y confirma (sección 10 tiene la lista completa).
5. Vuelve a la sección 2.7 y date el rol de superadmin.

### 3.4 Región de las funciones

Vercel ejecuta el código del servidor en una región. Para que las consultas a la base sean rápidas,
elige la región más cercana a tu proyecto de Supabase (São Paulo, `gru1`) en la configuración de
Functions del proyecto, si tu plan lo permite.

Las rutas de IA declaran hasta 120 s de duración (`maxDuration` en `src/app/api/ai/*/route.ts`) y el
cron 60 s. Comprueba en Vercel que tu plan permita esas duraciones.

### 3.5 Dominio

1. Agrega tu dominio en la configuración de dominios del proyecto en Vercel.
2. En tu registrador de dominio, crea los registros DNS que Vercel te indique. Vercel emite el
   certificado HTTPS solo.
3. Cuando el dominio funcione, actualiza **todo** lo que apuntaba a la URL anterior:

| Dónde | Qué cambiar |
|---|---|
| Vercel | `NEXT_PUBLIC_SITE_URL` (y luego *Redeploy*) |
| Supabase → Authentication | Site URL y Redirect URLs (`/auth/confirm`, `/auth/callback`) |
| Stripe | URL del endpoint del webhook |
| Mercado Pago | URL de notificación del webhook |
| Google Cloud | Orígenes autorizados de JavaScript (si usas Google) |
| Cron externo | URL de `/api/cron/reminders` (si usas uno) |

> La app envía `Strict-Transport-Security` con `includeSubDomains` y `preload` (`next.config.ts`).
> Todos los subdominios de tu dominio tienen que funcionar con HTTPS.

### 3.6 Despliegues de vista previa (Preview)

Cada rama o PR genera una URL de vista previa. Si cargas las variables de producción también en
**Preview**, esas vistas usan **tu base de datos real** y tus claves de pago. Lo más seguro: deja las
claves secretas solo en Production y, si necesitas previews completas, usa otro proyecto de Supabase y
claves de prueba.

Si activas protección de acceso para producción, Stripe, Mercado Pago y el cron no podrán llegar a la
app: mantén producción accesible.

---

## 4. Google OAuth (opcional)

1. En Google Cloud, crea un proyecto, configura la pantalla de consentimiento de OAuth (nombre de la
   app, correo de soporte, dominio y enlace a la política de privacidad publicada) y crea un cliente
   OAuth de tipo **Aplicación web**:
   - Orígenes autorizados de JavaScript: `https://tudominio.pe`.
   - URI de redirección autorizada: `https://<ref>.supabase.co/auth/v1/callback` (la de Supabase, no la
     de la app).
2. En Supabase → Authentication → proveedores, activa **Google** y pega el Client ID y el Client
   Secret.
3. Comprueba que `https://tudominio.pe/auth/callback` esté en las Redirect URLs (sección 2.4). Esa ruta
   la atiende `src/app/auth/callback`.
4. En Vercel, pon `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true` y vuelve a desplegar. El botón aparece en
   `/ingresar` y `/registro` (`src/features/auth/components/google-button.tsx`).

Google puede pedirte verificar la pantalla de consentimiento antes de abrirla a todo el público.
Esto **no se probó** con credenciales reales.

---

## 5. Anthropic (IA)

### Clave y modelos

1. Crea una clave de API en la consola de Anthropic y cárgala en Vercel como `ANTHROPIC_API_KEY`.
2. Por defecto las tres tareas usan `claude-opus-5-5`. Puedes cambiar cada una con `AI_MODEL_VISION`
   (foto), `AI_MODEL_TEXT` (texto y voz) y `AI_MODEL_CHAT` (asistente).

Precios de referencia en USD por millón de tokens, según `src/lib/ai/pricing.ts` (tabla oficial
cacheada el 2026-10-06; confirma los vigentes en la web de Anthropic antes de decidir):

| Modelo | ID | Entrada | Salida |
|---|---|---|---|
| Claude Opus 5.5 (por defecto) | `claude-opus-5-5` | 4.00 | 20.00 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 2.00 | 10.00 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 0.10 | 0.50 (prompts de hasta 100K tokens) |

- Los IDs van tal cual, sin sufijos de fecha.
- La app activa el reintento del lado del servidor ante una negativa (`fallbacks: "default"`), salvo
  con modelos Haiku (`src/lib/ai/anthropic.ts`). Ese reintento puede usar otro modelo con otro precio
  (por ejemplo Opus 5 u Opus 4.8 a 5/25); el costo estimado lo considera.
- Si eliges un modelo que no está en la tabla de `pricing.ts`, el costo estimado queda vacío (no se
  inventa).
- Un modelo más barato puede rendir distinto. Prueba con tu cuenta antes de cambiar.

### Cupos y límites dentro de la app

| Límite | Valor | Dónde se cambia |
|---|---|---|
| Plan Gratis | 0 en foto, texto, voz y chat (la IA es Premium) | `/admin/planes` |
| Plan Premium, por mes | Foto 120 · texto 300 · voz 300 · chat 400 | `/admin/planes` (semilla en `supabase/seed/00_base.sql`) |
| Por persona, por minuto | Foto 6 · texto 12 · voz 12 · chat 20 | Código: `AI_RATE_LIMITS` en `src/features/ai/server/http.ts` |

- El mes se cuenta en la zona horaria del perfil.
- La voz grabada y transcrita en el servidor usa **2** del cupo de voz; con el dictado del navegador,
  usa 1.
- Además del plan, la persona tiene que dar su permiso de IA (`ai_processing`) desde la propia pantalla.
- Sin clave no se consume cupo: la API responde 503 antes.

### Costos y control

- Cada solicitud guarda tokens y un **costo estimado** en USD. Lo ves por mes, tipo y modelo en
  `/admin/ia`. La factura real es la de Anthropic.
- Revisa en la consola de Anthropic los límites de uso (rate limits) y de gasto de tu organización:
  dependen del nivel de tu cuenta. Si se alcanzan, la app responde 429 `AI_RATE_LIMITED`.
- Las primeras semanas, revisa `/admin/ia` y la consola de Anthropic con frecuencia.

Esto **no se probó** con una clave real: todo se probó con el SDK simulado (`docs/modules/ia.md`).

---

## 6. Stripe (tarjeta internacional)

Trabaja primero en **modo de prueba** (claves `sk_test_…`) y pasa a modo real al final (paso 6.7).

### 6.1 Productos y precios

1. En Stripe, crea un producto «Premium».
2. Crea un **precio recurrente** por cada fila de `plan_prices` que quieras cobrar con tarjeta. La app
   ofrece Stripe para la opción en **dólares** (`src/features/billing/catalog-view.ts`). Con la semilla:
   - USD 7.99 cada mes.
   - USD 54.99 cada año.
3. El monto, la moneda y el intervalo deben ser **iguales** a los de la fila en `/admin/planes`: la
   app muestra el monto de su tabla, pero Stripe cobra el de su precio.
4. No configures la prueba gratis en Stripe: la app la pide al crear el checkout
   (`subscription_data.trial_period_days`, con los días del precio o `default_trial_days`) y solo la
   ofrece en la primera suscripción.

### 6.2 Cargar los `stripe_price_id`

En `/admin/planes`, edita cada precio y pega su id de Stripe (`price_…`) en `stripe_price_id`. Sin él,
ese precio aparece como «pendiente de configurar en Stripe».

### 6.3 Webhook

En el panel de Stripe, crea un endpoint de webhook:

- **URL:** `https://tudominio.pe/api/billing/webhooks/stripe`
- **Eventos** (los que maneja `processStripeEvent` en `src/lib/billing/stripe.ts`):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `customer.subscription.paused`
  - `customer.subscription.resumed`
  - `invoice.paid`
  - `invoice.payment_failed`

Copia el **secreto de firma** del endpoint (`whsec_…`) a `STRIPE_WEBHOOK_SECRET`.

Si el panel te deja elegir la versión de la API del endpoint, usa la misma que trae el SDK instalado
(`2026-09-30.endive`, `stripe` 23). La app no fija versión al llamar a Stripe.

Cómo responde el webhook: firma inválida o ausente → 400; sin secreto o sin clave de servicio → 503;
evento repetido → 200 sin reprocesar; error al procesar → 500 y Stripe lo reintenta.

### 6.4 Portal del cliente

Activa y configura el **portal de clientes** (*Customer portal*) en Stripe. Desde
`/app/perfil/suscripcion`, «Gestionar pago» abre ese portal. Sin configurarlo, la ruta
`/api/billing/portal` responde 502 con el error de Stripe. Cambiar de mensual a anual y reactivar una
cancelación programada se hacen desde ese portal: habilita esas opciones en su configuración.

### 6.5 Claves en Vercel

`STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, las dos. Luego *Redeploy*.

### 6.6 Interruptor

La semilla trae `payments_stripe = true`: con las claves cargadas, Stripe queda disponible de
inmediato. Si no quieres cobrar todavía, apágalo en `/admin/configuracion` (sección de medios de pago).

### 6.7 Pasar a modo real

Las claves, el webhook y los precios de prueba **no existen** en modo real. Al pasar:

1. Crea de nuevo el producto y los precios en modo real.
2. Reemplaza los `stripe_price_id` en `/admin/planes`.
3. Crea el endpoint del webhook en modo real (mismos eventos) y usa su nuevo `whsec_…`.
4. Cambia `STRIPE_SECRET_KEY` (`sk_live_…`) y `STRIPE_WEBHOOK_SECRET` en Vercel y vuelve a desplegar.
5. Configura el portal de clientes también en modo real.

Esto **no se probó** contra Stripe real: se probó con eventos firmados en local.

---

## 7. Mercado Pago (soles)

1. En el panel de desarrolladores de Mercado Pago, crea una aplicación y copia el **Access Token**
   (primero el de prueba, luego el de producción) a `MERCADOPAGO_ACCESS_TOKEN`.
2. En la configuración de webhooks de tu aplicación:
   - **URL de notificación:** `https://tudominio.pe/api/billing/webhooks/mercadopago`
   - **Eventos:** los de *Planes y suscripciones* (`subscription_preapproval` y
     `subscription_authorized_payment`). El código también acepta `preapproval` y `authorized_payment`
     (`src/lib/billing/mercadopago.ts`).
   - Copia la **clave secreta** que genera el panel a `MERCADOPAGO_WEBHOOK_SECRET`. Con ella se verifica
     la cabecera `x-signature`; después la app siempre consulta el recurso real en Mercado Pago.
3. Carga las dos variables en Vercel y vuelve a desplegar.
4. **Enciende Mercado Pago en `/admin/configuracion`** (`payments_mercadopago`). La semilla lo trae en
   `false`: aunque haya claves, la app lo muestra «no disponible por ahora» y el checkout responde 503
   `PROVIDER_DISABLED` hasta que lo enciendas.

Ten en cuenta:

- Mercado Pago cobra **solo en soles (PEN)**: usa los precios PEN de `/admin/planes`. No usa
  `mercadopago_plan_id` (la suscripción se crea sin plan, con el monto en cada cobro).
- La URL de retorno debe ser `https` (sale de `NEXT_PUBLIC_SITE_URL`).
- Para probar, usa las credenciales y los usuarios de prueba de Mercado Pago. Prueba también con una
  cuenta cuyo correo en la app sea distinto del de Mercado Pago (la app envía el correo de la cuenta
  como `payer_email`).
- La prueba gratis depende de la cuenta: si Mercado Pago la ignora, el primer cobro sería inmediato
  (`docs/modules/pagos.md`).
- Al cancelar, Mercado Pago deja de cobrar de inmediato; la app conserva Premium hasta el fin del
  periodo pagado. Una suscripción cancelada no se puede reactivar.

Esto **no se probó** contra Mercado Pago real: la firma HMAC se probó en local y su API con respuestas
simuladas.

---

## 8. Notificaciones push (VAPID) y cron de recordatorios

### 8.1 Claves VAPID

```bash
npx web-push generate-vapid-keys
```

Carga en Vercel: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (la pública), `VAPID_PRIVATE_KEY` (la privada) y
`VAPID_SUBJECT` (`mailto:soporte@tudominio.pe`). Vuelve a desplegar.

- No cambies el par de claves después de abrir: las suscripciones ya creadas dejarían de funcionar y
  cada persona tendría que volver a activar push en `/app/notificaciones`.
- En iPhone/iPad, el push web solo funciona con la app instalada en la pantalla de inicio (iOS 16.4 o
  superior), ver `docs/MOBILE.md`.

### 8.2 Qué hace el cron

`GET /api/cron/reminders` (`src/app/api/cron/reminders/route.ts`):

1. Crea los recordatorios que tocan según las preferencias de cada persona y **su hora local**: agua
   cada N horas dentro de su horario, registro de comidas una vez al día, pesaje semanal y ayuno
   completado. No repite ni pide lo que ya se hizo (`src/lib/notifications/reminders.ts`).
2. Envía por push lo pendiente de las últimas 24 h (si VAPID está configurado).

Protección: exige `Authorization: Bearer <CRON_SECRET>`. Sin el encabezado correcto responde 401; sin
`CRON_SECRET` o sin clave de servicio, 503.

Frecuencia recomendada: **cada hora**. El código está pensado para correr cada 15 a 60 minutos.

### 8.3 Opción A — Vercel Cron

1. Define `CRON_SECRET` en Vercel (16 caracteres o más). Cuando la variable existe, Vercel envía
   automáticamente `Authorization: Bearer <CRON_SECRET>` al llamar a tus cron jobs.
2. El repo **todavía no tiene** `vercel.json`. Créalo en `orange-fit/vercel.json` (la raíz del proyecto
   en Vercel):

   ```json
   {
     "crons": [
       { "path": "/api/cron/reminders", "schedule": "0 * * * *" }
     ]
   }
   ```

3. Haz commit y despliega. El horario está en **UTC**. Los cron jobs corren solo en el despliegue de
   **producción**.

**Límites según el plan.** En el plan Hobby, Vercel permite como máximo una ejecución al día (y no al
minuto exacto); una expresión más frecuente puede hacer fallar el despliegue. Pro permite frecuencias
mucho mayores. Vercel cambia estos límites: **verifica los vigentes en su documentación de Cron Jobs
antes de configurarlo.** Según esa documentación, una ejecución fallida no se reintenta: revisa los
registros del cron en Vercel de vez en cuando.

Si te quedas con una sola ejecución al día, usa `"0 1 * * *"` (01:00 UTC = 20:00 en Lima): coincide
con la hora por defecto del recordatorio de registro (20 h). Los recordatorios de agua y el aviso de
fin de ayuno llegarán, como mucho, una vez al día.

### 8.4 Opción B — cron externo

Si tu plan no permite la frecuencia que quieres, usa cualquier servicio que pueda hacer una petición
HTTPS GET programada con un encabezado propio. La llamada es:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tudominio.pe/api/cron/reminders
```

Ejemplo con GitHub Actions (el archivo va en la **raíz del repositorio**, no en `orange-fit/`:
`.github/workflows/recordatorios.yml`; guarda `CRON_SECRET` como secreto del repo):

```yaml
name: Recordatorios
on:
  schedule:
    - cron: "5 * * * *"   # cada hora, minuto 5 (UTC)
  workflow_dispatch: {}
jobs:
  llamar:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" https://tudominio.pe/api/cron/reminders
```

GitHub ejecuta los flujos programados desde la rama principal y puede retrasarlos o pausarlos: revisa
que sigan corriendo. Usa **una sola** opción (Vercel Cron o externa), no las dos.

### 8.5 Comprobar

- Sin encabezado: `curl -i https://tudominio.pe/api/cron/reminders` → 401.
- Con el secreto → 200 con `{ ok, ranAt, reminders, push }`.
- En `/app/notificaciones`, activa push en tu dispositivo y envía la notificación de prueba.

Push **no se probó** con claves VAPID reales.

---

## 9. USDA FoodData Central (opcional)

1. Pide una clave gratuita en api.data.gov y cárgala en Vercel como `FDC_API_KEY`. Vuelve a desplegar.
2. Importa desde `/admin/alimentos/importar` (por búsqueda o por FDC ID). Necesita también la clave de
   servicio de Supabase.
3. Lo importado entra público, `verified`, con licencia de dominio público y el nombre en inglés (como
   viene de FDC); el staff puede traducirlo después.

También existe el CLI `npx tsx scripts/import-usda.ts --query "quinoa" --limit 20` (y `--dry-run`).
Lee `.env.local`: si lo usas contra producción, asegúrate de que ese archivo apunte a producción y
bórralo o vuelve a apuntarlo a local después. Esto **no se probó** contra la API real de USDA.

---

## 10. Lista de verificación

### 10.1 Después de desplegar

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Abre `/`, `/precios`, `/faq` | Cargan; los precios salen de la base |
| 2 | Regístrate en `/registro` con un **correo real** | Llega el correo de tu SMTP con el asunto «Confirma tu correo» |
| 3 | Abre el enlace en **otro** navegador o en el celular | Entra a la app y sigue al onboarding (`/auth/confirm`). Si cae en `/verificar?error=enlace`, revisa la plantilla y la Site URL |
| 4 | Completa el onboarding | Llegas a `/app` con tus metas |
| 5 | Pide recuperar la contraseña en `/recuperar` | Llega «Crea una contraseña nueva» y el enlace abre `/nueva-clave` |
| 6 | Date superadmin (sección 2.7) y entra a `/admin` | Ves el panel y el estado de cada integración |
| 7 | Entra a `/admin` con otra cuenta sin rol | Página 404 |
| 8 | Compra de prueba con Stripe en **modo de prueba**: `/app/premium` → tarjeta de prueba de Stripe | Vuelves a `/app/premium/gracias` y dice que ya tienes Premium (o «Estamos confirmando tu pago» unos segundos) |
| 9 | En el panel de Stripe, revisa las entregas del webhook | Respuestas 200 |
| 10 | En `/app/perfil/suscripcion`: cancela la renovación y abre «Gestionar pago» | La cancelación queda programada; el portal abre |
| 11 | (Si usas Mercado Pago) lo mismo con usuarios de prueba | Igual que con Stripe |
| 12 | IA con clave: con Premium, en `/app/agregar/texto` escribe «150 g de pollo y una taza de arroz» | Propone alimentos de la base y **no registra nada** hasta que confirmas. `/admin/ia` muestra la solicitud y su costo estimado |
| 13 | Código de barras en `/app/agregar/codigo` con un producto real | Lo encuentra en la base o en Open Food Facts |
| 14 | Push y cron (sección 8.5) | 401 sin secreto, 200 con secreto, notificación de prueba recibida |
| 15 | Elimina una cuenta de prueba **sin suscripción activa** desde `/app/perfil/privacidad` | Se borra la cuenta y sus archivos; queda registro en `/admin/auditoria`. Con una suscripción que sigue cobrando responde 409 y pide cancelarla primero |
| 16 | Instala la PWA desde el navegador del celular | Se instala y abre en `/app` |
| 17 | Revisa `/admin/errores` | Sin errores nuevos |

### 10.2 Obligatorio antes de abrir al público

- [ ] **Correo de soporte:** en `/admin/configuracion`, cambia `support_email` (viene
      `soporte@example.com`). Se muestra en el pie, FAQ, legales, pagos y en el identificador que la
      app envía a Open Food Facts.
- [ ] **Textos legales:** en `/admin/contenidos` están `terminos`, `privacidad` y `datos-de-salud`
      **en borrador**. Completa los datos entre corchetes (`[RAZÓN SOCIAL]`, `[RUC]`, `[DIRECCIÓN]`,
      `[CORREO DE SOPORTE]`), haz que **un abogado** los revise (Ley N.° 29733 y protección al
      consumidor) y publícalos. Hasta entonces, `/legal/*` muestra «Documento en preparación», pero el
      registro ya enlaza a esas páginas. Si cambias el fondo de los textos de consentimiento, coordina
      con desarrollo el cambio de `CONSENT_VERSION` (`src/features/auth/consents.ts`).
- [ ] **Nombre de la app** (es provisional): cambia `app_name` en `/admin/configuracion` y
      `NEXT_PUBLIC_APP_NAME` en Vercel (y vuelve a desplegar). El nombre también está escrito en las
      plantillas de correo (sección 2.4), en las preguntas frecuentes y legales de la semilla (edítalas
      en `/admin/contenidos`) y en el nombre del producto de Stripe.
- [ ] **Precios de Premium** revisados en `/admin/planes` y alineados con Stripe (sección 6.1).
- [ ] **Pagos en modo real** (sección 6.7) y Mercado Pago encendido solo si ya lo probaste.
- [ ] **Datos semilla revisados:** alimentos sin verificar, recetas sin revisión profesional y
      precios referenciales sin fuente (sección 2.3).
- [ ] **SMTP propio** funcionando y dominio del remitente verificado.
- [ ] **Respaldos** definidos (sección 11).

---

## 11. Actualizar y respaldar

### Respaldo

- Revisa en el panel de Supabase qué respaldos automáticos incluye tu plan (el gratuito es limitado).
- Haz además tu propio respaldo, sobre todo **antes de cada migración** (el CLI usa Docker para este
  comando):

  ```bash
  npx supabase db dump --linked -f respaldo/esquema.sql
  npx supabase db dump --linked --data-only -f respaldo/datos.sql
  npx supabase db dump --linked --role-only -f respaldo/roles.sql
  ```

- El respaldo contiene datos de salud y correos: guárdalo cifrado, fuera del repositorio y con acceso
  restringido.
- Los archivos de Storage (fotos) **no** van en ese volcado: respáldalos aparte.

### Actualizar la app

1. En local, corre `npm run check` (lint, typecheck, pruebas y build).
2. Si hay migraciones nuevas en `supabase/migrations/`:
   1. Respalda (arriba).
   2. `npx supabase db push --dry-run` para ver qué se aplicará.
   3. `npx supabase db push`.
   4. `npx supabase migration list --linked` para confirmar.
3. Fusiona a la rama de producción: Vercel despliega solo.
4. Repite las pruebas de la sección 10.1 que toquen lo que cambió.

Reglas:

- Aplica las migraciones **antes** de desplegar el código que las necesita. Si no, la app nueva
  consultaría columnas o funciones que todavía no existen.
- **Nunca** edites una migración ya aplicada: crea una nueva.
- Si una versión sale mal, Vercel permite volver a un despliegue anterior. La base **no** vuelve atrás
  sola: por eso conviene que las migraciones solo agreguen cosas.
- No vuelvas a correr `00_base.sql` en producción si ya editaste los planes (sección 2.3).

---

## Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| Las pantallas dicen que falta configurar Supabase | Faltan `NEXT_PUBLIC_SUPABASE_URL` o la clave pública, o no se volvió a desplegar después de cargarlas |
| Todo lo del servidor falla de golpe (IA, pagos, admin) | Una variable no pasa la validación: `CRON_SECRET` con menos de 16 caracteres o `TRANSCRIPTION_PROVIDER` distinto de `none`/`openai` |
| El enlace del correo lleva a `/verificar?error=enlace` | Plantilla no copiada, Site URL distinta del dominio, o enlace vencido |
| El correo no llega | SMTP sin configurar o límite de envío de Auth alcanzado |
| Botón de pago deshabilitado: «Pagos pendientes de configurar» | Falta una de las dos variables del proveedor |
| «Precio pendiente de configurar en Stripe» | Falta `stripe_price_id` en `/admin/planes` |
| Mercado Pago «no disponible por ahora» | `payments_mercadopago` apagado en `/admin/configuracion` |
| Webhook con 400 | Secreto de firma equivocado (¿de prueba en lugar de real, o al revés?) |
| Webhook con 503 | Falta el secreto del webhook o `SUPABASE_SERVICE_ROLE_KEY` |
| La IA dice «pendiente de configurar» con clave cargada | No se volvió a desplegar, o Anthropic rechazó la clave (también responde 503 `AI_NOT_CONFIGURED`) |
| El cron responde 401 | El encabezado no es exactamente `Authorization: Bearer <CRON_SECRET>` |
