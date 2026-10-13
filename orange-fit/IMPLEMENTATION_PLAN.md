# ORANGE FIT — Plan de implementación

Plataforma de nutrición, control calórico y transformación física. Marca propia (nombre
configurable en `/admin/configuracion`), colorimetría naranja, mobile-first, PWA instalable y
preparada para empaquetarse con Capacitor más adelante.

## Referencia y alcance
Paridad funcional con los módulos **públicos** de Fitia (registro por foto, texto y código de
barras, base de alimentos verificable, planes con preferencias, lista de compras automática,
ayuno, premium), sin copiar código, textos, imágenes, logotipos, testimonios ni diseño. fitia.app
no fue accesible desde el entorno de desarrollo; el inventario funcional sale de fuentes públicas
y del brief del producto.

| Observable públicamente | No observable (diseñado por nosotros) |
|---|---|
| Registro de comidas: foto IA, texto, código de barras, búsqueda | Algoritmo exacto del planificador |
| Planes de comidas con preferencias (keto, alta proteína…) | Fuentes y procesos internos de verificación |
| Lista de compras desde el plan | Reglas de gamificación y notificaciones |
| Ayuno intermitente, agua, progreso | Modelo de costos de IA y cuotas |
| Freemium con premium (planes, recetas, analítica) | Panel administrativo |

## Arquitectura (resumen)
Ver `docs/ARCHITECTURE.md`. Next.js 16 (App Router, Turbopack, `proxy.ts`), TypeScript estricto,
Tailwind v4 + componentes propios estilo shadcn (Radix), Motion, Lucide, TanStack Query, Zod,
React Hook Form, Recharts; Supabase (Postgres + Auth + Storage) con RLS en todas las tablas;
servicios con adaptadores: IA (Claude), pagos (Stripe, Mercado Pago), alimentos (USDA FDC, Open
Food Facts), push (Web Push/VAPID).

Separación: `(marketing)` sitio público · `(auth)` acceso · `onboarding` · `app` usuario ·
`admin` panel · `api` backend · `src/lib/nutrition` motor puro · `src/lib/ai`, `src/lib/billing`,
`src/lib/foods` servicios · `supabase/` base de datos.

## Fases y criterios de aceptación

### Fase 0 — Fundaciones
- Scaffold Next 16 + dependencias, TS estricto, ESLint, Vitest, Playwright, Supabase CLI.
- Sistema de diseño naranja claro/oscuro, componentes base, shells (marketing, app, admin).
- Migraciones completas con RLS, funciones, storage; tipos generados.
- Motor nutricional con tests.
**Aceptación:** `supabase db reset` sin errores; tests de RLS pasan (aislamiento entre usuarios,
roles); motor con tests verdes; `tsc` limpio.

### Fase 1 — Autenticación, onboarding y dashboard
- Registro/ingreso con email, verificación, recuperación, Google OAuth (pendiente de credenciales),
  cierre de sesión, rutas protegidas, perfil persistente.
- Onboarding progresivo (antes del registro) con cálculo explicado, cribado de riesgo y
  consentimientos (términos, privacidad, datos de salud, IA).
- Dashboard: saludo, fecha, anillo calórico, macros, fibra, agua, peso, racha, accesos,
  recordatorios y recomendaciones; desglose base/ejercicio/ajustes.
**Aceptación:** E2E registro → verificación por correo (Mailpit local) → onboarding → dashboard con
metas guardadas; un menor de edad o embarazo no recibe déficit automático.

### Fase 2 — Diario y alimentos
- Diario por comidas (desayuno, almuerzo, cena, snacks, personalizadas), CRUD, duplicar, copiar a
  otros días, favoritos, alimentos propios, plantillas, fechas anteriores; totales en vivo.
- Base de alimentos normalizada con procedencia, búsqueda por similitud, porciones, importador
  USDA, consulta Open Food Facts por código de barras, deduplicación y revisión en admin.
**Aceptación:** registrar, editar y borrar actualiza totales; búsqueda encuentra "aji de gallina"
sin tildes; cada ítem guarda su procedencia.

### Fase 3 — IA
- Foto, voz (dictado del navegador + adaptador de transcripción opcional), texto, código de barras.
- La IA identifica; los nutrientes salen de la base; confirmación obligatoria; incertidumbre visible;
  cuotas por plan; registro de uso y costo; errores reales sin clave.
- Asistente nutricional con límites y respuestas seguras.
**Aceptación:** sin `ANTHROPIC_API_KEY` la UI muestra "pendiente de configurar" y la API responde 503;
con clave, ninguna comida se guarda sin confirmar.

### Fase 4 — Recetas, planificador y compras
- Catálogo de recetas con filtros, escalado por porciones, favoritos, propias, al diario.
- Planificador determinista (sin IA) con calorías, macros, alergias, preferencias, presupuesto y
  tiempo; cambios, regeneración, plan manual, guardar, PDF, compartir con consentimiento.
- Lista de compras consolidada por categorías con presupuesto referencial en PEN.
**Aceptación:** plan de 7 días dentro de ±10 % de kcal con recetas suficientes y sin alérgenos
excluidos; la lista suma ingredientes repetidos.

### Fase 5 — Seguimiento
- Peso, % grasa (como estimación), medidas, fotos privadas, gráficos con promedio móvil y
  tendencias, comparaciones, adherencia; agua; ayuno con avisos y bloqueos; actividad por MET;
  gamificación sin castigos.
**Aceptación:** fotos solo accesibles por el dueño (URL firmada); ayuno bloqueado para perfiles de riesgo.

### Fase 6 — Premium y admin
- Planes y precios en BD; página de precios; Stripe y Mercado Pago con checkout, webhooks firmados
  e idempotentes, cancelación y estado; límites de IA.
- `/admin`: métricas sin PII, usuarios, alimentos, recetas (moderación), contenidos, planes y
  precios, configuración (nombre de la app), IA (uso y costo), auditoría, errores; roles.
**Aceptación:** webhook con firma inválida → 400; usuario sin rol no ve `/admin` (404).

### Fase 7 — Landing, PWA y calidad
- Landing propia con capturas reales de la app, precios, FAQ, legales; SEO (metadata, sitemap,
  robots, OG); PWA (manifest, iconos, service worker, página sin conexión).
- Revisión adversarial (seguridad/RLS, nutrición, honestidad, UX móvil, pagos), lint, typecheck,
  unit, integración, E2E y build.

## Pendiente de credenciales externas (no se simula)
Supabase en la nube, Google OAuth, Anthropic, transcripción opcional, Stripe, Mercado Pago,
USDA FDC, VAPID, `CRON_SECRET`. Ver `docs/DEPLOYMENT.md` y `FEATURES.md`.
