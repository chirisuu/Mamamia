# App móvil — estado actual y cómo empaquetarla más adelante

> **Hoy NO existe una app nativa** de ORANGE FIT en App Store ni en Google Play. Lo que existe es la
> web (Next.js) **instalable como PWA**: en Android (Chrome, Edge, Samsung Internet) aparece «Instalar
> app»; en iPhone/iPad se instala desde Safari con **Compartir → Agregar a inicio**. Ninguna pantalla,
> texto de marketing ni metadato debe insinuar que hay una app en las tiendas.

## 1. Lo que ya funciona como PWA

| Pieza | Archivo | Qué hace |
|---|---|---|
| Manifiesto | `src/app/manifest.ts` → `/manifest.webmanifest` | Nombre vigente (`app_settings.app_name`), `short_name`, `start_url /app`, `display standalone`, colores de marca, iconos `any` + `maskable`, atajos a «Registrar comida» (`/app/agregar/buscar`) y «Agua» (`/app/agua`), capturas si existen en `public/screenshots/`. |
| Iconos | `public/icons/*`, `public/favicon.ico` | Generados con `node scripts/generate-icons.mjs` desde `public/icons/logo.svg` (192, 512, maskable 512, apple-touch 180, insignia monocroma 96, favicon 16/32/48). |
| Service worker | `public/sw.js` | Precarga `offline.html` e iconos; navegaciones network-first con página sin conexión; `/_next/static` cache-first; **nunca** cachea `/api`, `/auth`, páginas ni respuestas privadas. Push `{ title, body, url }` y `notificationclick`. |
| Registro del SW | `src/components/pwa/register-sw.tsx` | Solo en producción (o con `NEXT_PUBLIC_ENABLE_SW=true`). Hoy se monta en el sitio público; ver §6. |
| Botón «Instalar» | `src/components/pwa/install-button.tsx` | Usa `beforeinstallprompt`; en iOS muestra las instrucciones de Safari; no aparece si ya está instalada o el navegador no lo permite. |
| Sin conexión | `public/offline.html` | Página autónoma (sin JS ni CSS externos). No hay registro sin conexión: lo dice. |

Límites de la PWA que una app nativa resolvería:

- **iOS**: push web solo con la app instalada en inicio (iOS 16.4+) y tras pedir permiso desde un gesto
  del usuario; sin Apple Health; la cámara y el micrófono funcionan en Safari pero piden permiso cada
  cierto tiempo.
- **Android**: sin Health Connect desde el navegador.
- **Ambos**: sin presencia en tiendas, sin widgets ni recordatorios locales programados fiables (los
  recordatorios llegan por push desde `/api/cron/*`).

## 2. Empaquetar con Capacitor (cuando se decida)

Capacitor envuelve la web en un WebView nativo y expone plugins (cámara, notificaciones, salud). Hay
dos modos y **la app actual solo es compatible con el primero sin reescribir nada**.

### Modo A — servidor remoto (recomendado para empezar)

El WebView carga la URL de producción (`server.url`). La app sigue siendo la de Next (Server
Components, Server Actions, route handlers, Supabase con cookies), y cada despliegue web actualiza la
app sin pasar por revisión (siempre que no cambie código nativo).

```ts
// capacitor.config.ts (no existe todavía)
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "pe.orangefit.app", // definir el definitivo antes del primer envío a tiendas
  appName: "ORANGE FIT",
  webDir: "public", // obligatorio aunque se use server.url
  server: {
    url: "https://<dominio-de-produccion>",
    cleartext: false,
    allowNavigation: ["<dominio-de-produccion>", "*.supabase.co", "checkout.stripe.com", "www.mercadopago.com.pe"],
  },
};
export default config;
```

Pasos: `npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android` (acordarlo antes: hoy
no están en `package.json`), `npx cap init`, `npx cap add ios`, `npx cap add android`, `npx cap sync`,
abrir en Xcode / Android Studio.

A tener en cuenta:
- **Apple (guía 4.2, funcionalidad mínima)** rechaza apps que son «solo un sitio web». Hay que aportar
  valor nativo real (notificaciones nativas, Apple Health, cámara nativa, widgets) antes de enviarla.
- **Sin conexión**: el WebView necesita red; mostrar `offline.html` empaquetado como página de error.
- **Autenticación**: las cookies de Supabase funcionan en el WebView del mismo dominio. Google OAuth
  dentro de un WebView está bloqueado por Google: usar `@capacitor/browser` (navegador del sistema) +
  deep link de vuelta (`pe.orangefit.app://auth/callback`) y agregarlo a las URL permitidas de Supabase.
- **Pagos**: las suscripciones digitales vendidas dentro de una app iOS/Android deben usar la compra
  dentro de la app (App Store / Google Play Billing) salvo excepciones regionales vigentes. Stripe y
  Mercado Pago (hoy en `/api/billing/*`) no pueden ofrecerse dentro de la app para desbloquear Premium
  sin revisar esas reglas: la decisión es de negocio y legal, no técnica. Opción típica: en la app nativa
  ocultar la compra y respetar Premium comprado en la web (`is_premium()` ya es la fuente de verdad).

### Modo B — export estático (`webDir` con el sitio compilado)

Empaquetar HTML/JS dentro de la app (`output: "export"`). **No es compatible con la app actual**: usa
Server Components dinámicos, Server Actions, route handlers (`/api/*`, webhooks, IA, cron), `proxy.ts`,
cookies de sesión y lecturas con RLS en el servidor. Pasar a este modo implicaría mover toda la lógica de
servidor a una API aparte y reescribir las lecturas como llamadas desde el cliente. Solo tendría sentido
si se necesita uso completo sin conexión.

## 3. Permisos

| Permiso | Para qué | iOS (`Info.plist`) | Android (`AndroidManifest.xml`) | Hoy en la web |
|---|---|---|---|---|
| Cámara | Foto del plato (`/app/agregar/foto`), código de barras (`/app/agregar/codigo`), fotos de progreso | `NSCameraUsageDescription`: «Para tomar la foto de tu plato, escanear códigos de barras y tus fotos de progreso.» | `android.permission.CAMERA` | `getUserMedia` / `<input capture>` con permiso del navegador |
| Fotos | Elegir una foto existente | `NSPhotoLibraryUsageDescription` | Selector del sistema (sin permiso en Android 13+) | `<input type=file>` |
| Micrófono | Registro por voz (`/app/agregar/voz`) | `NSMicrophoneUsageDescription`: «Para que dictes lo que comiste.» y `NSSpeechRecognitionUsageDescription` si se usa el reconocimiento de iOS | `android.permission.RECORD_AUDIO` | Web Speech API o `MediaRecorder` + `/api/ai/transcribe` |
| Notificaciones | Recordatorios de agua, comidas, pesaje y ayuno | Capability *Push Notifications* + APNs (`@capacitor/push-notifications`) | `POST_NOTIFICATIONS` (Android 13+) + FCM | Web Push con VAPID (`/api/push/*`, `public/sw.js`) |
| Salud | Leer entrenamientos, peso y agua; escribir agua | Capability *HealthKit* + `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` | Health Connect: permisos `android.permission.health.READ_EXERCISE`, `READ_WEIGHT`, `READ_HYDRATION`, `WRITE_HYDRATION` + pantalla de política de privacidad | **No disponible** (ver `docs/INTEGRATIONS.md`) |

Reglas: pedir cada permiso **en el momento en que se usa** (nunca al abrir la app), explicar antes para
qué es, y que todo siga funcionando si la persona dice que no (registro manual siempre disponible). Los
datos de salud requieren además el consentimiento `health_data` vigente (Ley N.° 29733).

## 4. Tiendas

- **Cuentas**: Apple Developer Program (pago anual) y Google Play Console (pago único).
- **Fichas**: nombre, descripción sin promesas de resultados («sin dietas extremas», «no reemplaza a un
  profesional de la salud»), capturas reales (las de `public/screenshots/` sirven de base), icono 1024 px
  (generar desde `public/icons/logo.svg` sin transparencia), clasificación por edad (contenido de salud;
  la app bloquea déficit a menores de 18 y el registro a menores de 13).
- **Privacidad**: App Privacy (Apple) y Data safety (Google) deben declarar datos de salud y fitness,
  fotos, audio (si se envía a transcribir), identificadores y compras; enlazar `/legal/privacidad` y
  `/legal/datos-de-salud` **publicados** (hoy están en preparación: no se puede enviar a revisión sin
  ellos).
- **Salud**: Apple exige que los datos de HealthKit no se usen para publicidad ni se compartan con
  terceros, y que la app explique su uso; Google exige declarar el uso de Health Connect y pasar su
  revisión de permisos.
- **Eliminación de cuenta dentro de la app**: obligatoria en ambas tiendas; ya existe en
  `/app/perfil/privacidad` (`POST /api/account/delete`).

## 5. Orden sugerido

1. Publicar los legales definitivos y fijar el dominio de producción.
2. Capacitor en modo A con push nativo (APNs/FCM) reutilizando `notifications` y `push_subscriptions`
   (agregar el tipo de token nativo con una migración aditiva).
3. Adaptador de salud según `docs/INTEGRATIONS.md`.
4. Decidir la estrategia de compras dentro de la app antes de enviar a revisión.

## 6. Pendiente para la integración web

- Montar `<RegisterServiceWorker />` (de `src/components/pwa/register-sw.tsx`) en el layout raíz o en el
  de `/app`, para que el SW quede registrado también para quien entra directo a la app (hoy se registra
  al visitar el sitio público o al activar push en Notificaciones).
- Declarar los iconos (`/favicon.ico`, `/icons/logo.svg`, `/icons/apple-touch-icon.png`) en los metadatos
  del layout raíz; hoy solo los declara el layout del sitio público.
