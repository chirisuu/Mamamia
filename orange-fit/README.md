# ORANGE FIT

Plataforma de nutrición para Perú: registro de comidas (búsqueda, código de barras, foto, voz y
texto con IA que siempre pide confirmación), metas calculadas con su explicación, plan semanal y
lista de compras en soles, seguimiento de peso, agua, ayuno y actividad, asistente nutricional,
plan Premium con Stripe y Mercado Pago, y panel de administración. Mobile-first e instalable (PWA).

El nombre es provisional: se cambia desde `/admin/configuracion`.

> Herramienta de organización, no reemplaza a un profesional de la salud. Los perfiles de riesgo
> (menores, embarazo, lactancia, antecedentes de trastornos de la conducta alimentaria, diabetes con
> medicación, enfermedad renal) no reciben déficit calórico ni ayuno automáticos.

## Qué funciona sin configurar nada

Con solo Supabase (local o en la nube) funcionan cuentas, onboarding, diario, base de alimentos,
recetas, planificador, compras, seguimiento, logros, landing y panel admin. Lo que depende de un
servicio externo (IA, pagos, USDA, push, Google) responde «pendiente de configurar» hasta que cargues
su clave: nunca simula un resultado. Detalle en [`FEATURES.md`](FEATURES.md).

## Correrlo en tu computadora

Requisitos: Node 20.9 o superior (recomendado 22), Docker Desktop (abierto) y Git.

```bash
git clone https://github.com/chirisuu/Mamamia.git
cd Mamamia && git checkout claude/orange-fit && cd orange-fit
npm install

npx supabase start        # base, auth, storage y correo locales (la primera vez descarga imágenes)
npx supabase db reset     # migraciones + datos semilla (alimentos peruanos, recetas, precios)

cp .env.example .env.local
# pega en .env.local la "anon key" y la "service_role key" que imprimió `supabase start`

npm run dev               # http://localhost:3000
```

- Los correos (confirmación, recuperación) llegan a Mailpit: http://localhost:54324
- Para entrar a `/admin`, da el rol a tu usuario desde la base local:
  `insert into user_roles (user_id, role) select id, 'superadmin' from auth.users where email = 'tu@correo.com';`
  (con `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres`).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` · `npm run typecheck` | ESLint y TypeScript |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:integration` | Pruebas contra el Supabase local (RLS, rutas, pagos, IA simulada) |
| `npm run test:e2e` | Playwright a 390 px contra la app compilada (requiere `npm run build`) |
| `npm run db:types` | Regenera `src/lib/db/database.types.ts` desde la base local |
| `npx tsx scripts/capture-screenshots.ts` | Capturas reales para la landing (con la app corriendo) |

## Documentación

| Documento | Contenido |
|---|---|
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | Fases y criterios de aceptación |
| [`FEATURES.md`](FEATURES.md) | Qué funciona, qué requiere credenciales y qué está pendiente |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Capas, flujo de datos y contratos entre módulos |
| [`docs/SECURITY.md`](docs/SECURITY.md) | RLS, secretos, consentimientos y Ley 29733 |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Supabase en la nube, Vercel, webhooks, correo, cron |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Reglas de código y de producto |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) | Tablas, funciones y políticas |
| [`docs/NUTRITION_ENGINE.md`](docs/NUTRITION_ENGINE.md) | Fórmulas y reglas del motor nutricional |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Colores, tipografía, componentes |
| [`docs/MOBILE.md`](docs/MOBILE.md) | PWA y cómo empaquetar con Capacitor |
| [`docs/modules/`](docs/modules) | Informe de cada módulo |
| [`docs/QA_PLAN.md`](docs/QA_PLAN.md) · [`docs/QA_LOG.md`](docs/QA_LOG.md) | Método de QA y fallos encontrados |
