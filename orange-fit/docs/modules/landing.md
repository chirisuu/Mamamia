# Módulo landing — sitio público, SEO, legales, PWA y errores

Dueño de: `src/app/(marketing)/*` (salvo `/precios`, de pagos), `src/features/marketing/`,
`src/components/pwa/`, `src/app/{manifest.ts,sitemap.ts,robots.ts,opengraph-image.tsx,error.tsx,
global-error.tsx,not-found.tsx}`, `src/app/api/errors/`, `public/{sw.js,offline.html,icons/,favicon.ico}`,
`scripts/generate-icons.mjs`, `docs/MOBILE.md`.

Solo hay **una** ruta `/`: `src/app/(marketing)/page.tsx` (el `src/app/page.tsx` provisional se eliminó).

## Qué quedó funcional

### Sitio público (`src/app/(marketing)`)
- **Layout**: `SiteHeader` + aviso de mantenimiento (`app_settings.maintenance_banner`) + `<main id="contenido">`
  + `SiteFooter` (legales, contacto y «no reemplaza a un profesional de la salud»), enlace «Saltar al
  contenido». Los iconos y el registro del service worker están en el layout raíz (`src/app/layout.tsx`). `loading.tsx` con `Skeleton`.
- **Portada `/`**: hero con propuesta y CTA reales (**Crear cuenta gratis → `/onboarding`**, **Ingresar →
  `/ingresar`**); cómo funciona (3 pasos); 12 funciones (manual, foto, voz, texto, código de barras, plan,
  recetas, compras, progreso, ayuno, agua, asistente) con etiqueta **Gratis/Premium leída de
  `plans.features`** (sin datos no se muestra etiqueta); registro con IA explicado con honestidad (estima y
  tú confirmas, la IA no inventa calorías, procedencia y valores en revisión, límites, permiso opcional);
  planes de comida; seguimiento sin castigos; «Tu salud va primero» (pisos 1200/1500 kcal y TMB, cribado de
  riesgo, Ley N.° 29733, no reemplaza a un profesional); precios desde `plans`/`plan_prices` (si fallan, lo
  dice y enlaza a `/precios`; nunca un monto inventado); 5 FAQ publicadas (si no hay, la sección no
  aparece; si falla la lectura, aviso); CTA final con «Instalar app» cuando el navegador lo permite.
  Sin testimonios, cifras de usuarios, logos ni valoraciones.
- **Capturas reales** `/screenshots/{inicio,diario,foto-ia,plan,progreso}.png` en marco de teléfono con
  `<img>` 390×844, `alt` descriptivo, `loading="lazy"` (la del hero `eager` + `fetchPriority="high"`).
  Si el archivo no existe en `public/` se muestra «Captura en preparación» (nunca un mockup ni una imagen
  rota). Hoy existen las reales de inicio, diario, plan y progreso (`scripts/capture-screenshots.ts`, lista en
  `screenshots.available.ts`); la de «foto con IA» necesita IA real y queda «Captura en preparación».
- **`/?cuenta=eliminada`**: aviso discreto `role="status"` («Tu cuenta fue eliminada…»), cerrar = enlace a `/`.
- **`/funciones`**: las 3 secciones (registrar, planificar, seguir) con todas las funciones y su plan, y
  «Cómo calculamos tus metas» (Mifflin-St Jeor, factor de actividad, ajuste con topes y pisos, macros y fibra).
- **`/faq`**: `content_pages` kind `faq` **publicadas** (filtro explícito `status = 'published'`, porque
  el staff también ve borradores por RLS) en `<details>` accesibles sin JS; vacío, error y contacto
  (`support_email` o «pendiente de configurar»); JSON-LD `FAQPage`.
- **`/legal/[slug]`** (`terminos`, `privacidad`, `datos-de-salud`; otro slug → 404): renderiza el documento
  **publicado** en markdown seguro con fecha de actualización. Si está en borrador, vacío o no existe:
  «Documento en preparación» + contacto, y `noindex` (no se lista en el sitemap). En `datos-de-salud` en
  preparación se muestra el texto exacto de la autorización que se pide en la app (`HEALTH_DATA_CONSENT_TEXT`,
  versión `CONSENT_VERSION` = `2026-10`, de `src/features/auth/consents.ts`). Si la lectura falla: error,
  no «en preparación». **Hoy los tres están en `draft`** en la BD → «Documento en preparación».
- Animaciones: `Reveal` (motion) como mejora progresiva (el HTML llega visible; solo se animan bloques que
  aún están fuera de pantalla; con movimiento reducido no anima). Sin JS de cliente extra: solo `Reveal`,
  `SiteHeader` (menú) e `InstallButton`.

### Markdown seguro (`src/features/marketing/markdown.tsx`)
Parser propio → árbol → elementos React (nunca `dangerouslySetInnerHTML`). Títulos (desplazados para no
competir con el `h1`), párrafos, listas, citas, código, separadores, negrita, cursiva, enlaces y autoenlaces.
`safeHref` solo acepta `http(s)`, `mailto`, rutas internas y anclas (quita espacios/controles para que
`java\tscript:` no pase; rechaza `//dominio` y `/\dominio`). Externos con `target=_blank rel="noopener
noreferrer nofollow"`. Tope de 60 000 caracteres y de anidación.

### SEO
- `pageMetadata()` por página: title (plantilla del layout raíz), description, canonical, Open Graph
  (`es_PE`, imagen) y Twitter `summary_large_image`; `noindex` para legales en preparación y la 404.
- `src/app/sitemap.ts`: `/`, `/funciones`, `/precios`, `/faq` y los legales **publicados** (si no se puede
  leer la BD, se listan los tres). URL base = `NEXT_PUBLIC_SITE_URL`.
- `src/app/robots.ts`: permite `/`; bloquea `/app` (exacto con `$` + `/app/`, para no bloquear
  `/apple-touch-icon.png`), `/admin`, `/api/`, `/auth/`, `/onboarding`, `/compartido/` y las pantallas de acceso.
- `src/app/opengraph-image.tsx`: `next/og` 1200×630 con **Geist** leída de
  `node_modules/geist/dist/fonts/geist-sans/Geist-{SemiBold,Regular}.ttf` y el nombre vigente de la app.
- JSON-LD `SoftwareApplication` (sin `aggregateRating` ni reseñas; ofertas solo si se leyeron precios) y
  `FAQPage`; serializado escapando `<`, `>`, `&`, U+2028/2029.

### PWA
- `src/app/manifest.ts` → `buildManifest()` (`src/features/marketing/pwa.ts`): nombre desde
  `getAppSettings()`, `short_name`, `id`/`start_url` `/app`, `scope /`, `standalone`, `portrait`, colores
  carbón, iconos `any` 192/512 y `maskable` 512, atajos «Registrar comida» (`/app/agregar/buscar`) y «Agua»
  (`/app/agua`), `screenshots` solo de las capturas que existan.
- `public/icons/logo.svg` (equivalente a `src/components/brand/logo.tsx`, con punto claro/oscuro por
  `prefers-color-scheme`) → `node scripts/generate-icons.mjs` (sharp) → `icon-192.png`, `icon-512.png`,
  `maskable-512.png` (marca dentro de la zona segura), `apple-touch-icon.png` (180), `badge-96.png`
  (monocroma para Android) y `public/favicon.ico` (16/32/48, PNG dentro de ICO). **Ejecutado**.
- `public/sw.js`: precarga `offline.html` + iconos; navegaciones network-first con `offline.html` sin red
  (las páginas **no** se guardan); `/_next/static/*` cache-first (con tope de 150 entradas); `/icons/*`
  stale-while-revalidate. **Nunca** intercepta `/api`, `/auth`, otros orígenes (Supabase, Storage firmado,
  Stripe), métodos ≠ GET ni peticiones con `Authorization`; no guarda respuestas `private`, `no-store`, con
  `Set-Cookie`, opacas o ≠ 200. `push` muestra `{ title, body, url }` (contrato de
  `src/lib/notifications/push.ts`) con icono e insignia; `notificationclick` enfoca la pestaña que ya está en
  la ruta, lleva otra pestaña de la app a esa ruta o abre una nueva. Solo rutas internas (lo demás →
  `/app/notificaciones`). Al cambiar el SW, subir `VERSION`.
- `public/offline.html`: autónoma (sin recursos externos), claro/oscuro, «Reintentar» y recarga al volver
  la conexión; aclara que lo no guardado no se envió (la app no sincroniza sin conexión).
- `src/components/pwa/register-sw.tsx` (`RegisterServiceWorker`, `shouldRegisterServiceWorker`): registra
  `/sw.js` tras `load`, solo en producción o con `NEXT_PUBLIC_ENABLE_SW=true`, `updateViaCache: "none"`.
- `src/components/pwa/install-button.tsx` (`InstallButton`, `useInstallState`, `detectInstallState`):
  `beforeinstallprompt` (guardado a nivel de módulo por si llega antes de montar); en iPhone/iPad (incluido
  iPadOS que se presenta como Mac) instrucciones «Compartir → Agregar a inicio»; no se muestra si ya está
  instalada o no se puede. Montado en el CTA final de la portada; exportado para otros módulos.

### Errores
- `src/app/error.tsx` y `src/app/global-error.tsx` usan `ErrorScreen`
  (`src/features/marketing/components/error-screen.tsx`): mensaje amable, **Reintentar** (`retry()`),
  **Ir al inicio** (recarga completa), código `digest` para soporte, foco al título, y reporte a
  `/api/errors` una sola vez. Solo dice «Enviamos un aviso al equipo» si el reporte realmente llegó.
  `global-error` trae `globals.css`, Geist y aplica el tema guardado por next-themes (o el del sistema).
- `src/app/not-found.tsx`: 404 de todo el sitio (también de `/app` y `/admin` sin uno más cercano; incluido
  el `notFound()` de `requireRole`), `noindex`, enlaces a la app, inicio, funciones, precios y FAQ.
- `src/features/marketing/report-error.ts` → `reportClientError(error, { route? })`: **reutilizable por
  cualquier `error.tsx`** de otros módulos. Envía solo mensaje, ruta (pathname) y digest con `keepalive`;
  deduplica por pestaña y corta a 10 reportes; nunca lanza.
- **`POST /api/errors`** (`{ message, route?, digest? }`): origen comprobado (`isSameOrigin` de auth) → 403;
  cuerpo > 16 KB → 413; JSON inválido → 400 `INVALID_JSON`; Zod → 400 `VALIDATION`; sin Supabase → 503.
  `user_id` **de la sesión** (campos extra del cuerpo se descartan), `user_agent` de la cabecera; todo
  truncado a los límites de la tabla (2000/500/200/500). Saneo (`error-report.ts`): ruta sin origen, query
  ni hash, token de `/compartido/<tipo>/<token>` → `[token]`, UUID → `[id]`; del mensaje se quitan
  correos, JWT, `Bearer …`, `token_hash=`/`code=`/`key=`…, cadenas largas con letras y dígitos y números
  de 9+ dígitos (tarjetas, celulares). Anónimo: cliente anon que **reenvía la IP del visitante**
  (`x-forwarded-for`), así el límite de la BD (20/h por IP) es por visitante y no por servidor; con sesión,
  60/h por usuario. Al pasar el límite la BD responde PT429 → **429 `RATE_LIMITED`**. Otros errores → 500
  sin detalle (en el log solo el código). Respuesta `201 { ok: true }`.

## Contratos
- Cumplidos: rutas del módulo; `/legal/terminos`, `/legal/privacidad`, `/legal/datos-de-salud` existen y
  muestran el documento publicado o «Documento en preparación»; aviso de `/?cuenta=eliminada`; `sw.js`
  con el payload `{ title, body, url }` de seguimiento y `data.url` de los avisos locales del ayuno.
- Nuevos (para otros): `reportClientError` (`@/features/marketing/report-error`), `ErrorScreen`,
  `InstallButton`/`useInstallState`, `RegisterServiceWorker`, `buildManifest`.
- Sin migraciones: `error_reports`, su trigger de límite y RLS ya existían.

## Requiere configuración
- `NEXT_PUBLIC_SITE_URL` (canonical, sitemap, robots, JSON-LD). Sin ella se usa `http://localhost:3000`.
- Supabase (precios, FAQ, legales, `/api/errors`). Sin él: precios y FAQ dicen que no se pudieron cargar,
  legales muestran error, `/api/errors` responde 503.
- Legales: publicarlos desde `/admin` (contenidos). Hasta entonces, «Documento en preparación».
- `support_email` en `app_settings` (hoy `soporte@example.com`, de ejemplo: cambiarlo).
- Detrás de un proxy propio, asegurar que `x-forwarded-for` lo fije el proxy (el primer valor se usa para el
  límite anónimo de `/api/errors`).

## Falta / límites conocidos
- **Capturas**: falta la de «foto con IA» (necesita una clave de Anthropic y una foto real); la portada
  muestra «Captura en preparación» en su lugar.
- `/precios` (pagos) vive fuera de `(marketing)`: pinta su propio encabezado y pie, pero no tiene el aviso de
  mantenimiento ni el enlace «Saltar al contenido» del sitio público.
- No hay modo sin conexión para registrar comidas (decisión: nada simulado).
- En este paso no se corrió `next build` (sí después, en la integración, junto con el recorrido de humo E2E). La revisión visual se hizo
  renderizando las páginas a HTML con datos reales de la BD local + Tailwind compilado y Chromium a 390 px
  y 1280 px (sin desbordes horizontales, claro y oscuro).

## Pruebas
- Unitarias: `src/features/marketing/seo.test.ts` (sitemap, robots con simulación de reglas, metadatos,
  JSON-LD sin valoraciones, escape), `markdown.test.tsx` (sanitización: HTML crudo, esquemas peligrosos,
  inyección de atributos, anidación y textos enormes), `error-report.test.ts` (Zod, saneo de mensaje y ruta,
  IP), `pwa.test.ts` (manifest, iconos en disco, instalación, registro del SW),
  `src/app/api/errors/route.test.ts` (403/400/413/429/500/503, usuario de la sesión, IP reenviada),
  `tests/unit/sw.test.ts` (análisis estático + ejecución del SW en un entorno simulado: nunca cachea
  `/api`, `/auth`, navegaciones ni respuestas privadas; push y clics), `tests/unit/landing-pages.test.tsx`
  (portada, legales, FAQ y funciones renderizadas), `tests/unit/opengraph-image.test.tsx` (PNG 1200×630 real).
- Integración: `tests/integration/landing.test.ts` (POST /api/errors real: anónimo con IP, 429 al pasar 20/h,
  otra IP sigue; con sesión; FAQ publicadas vs borradores; legales; precios desde la BD). Limpia lo que crea.
