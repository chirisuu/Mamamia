# Convenciones de código — ORANGE FIT

Contrato común para todo el que toque el repo (personas o agentes). Si algo aquí choca con
lo que necesitas, cámbialo aquí primero.

## Reglas de producto que no se negocian
1. **Nada simulado presentado como real.** Si falta una credencial o un servicio falla, la UI
   lo dice ("pendiente de configurar", "no se pudo conectar") y el servidor responde con error
   real. Nunca devolver datos inventados ni un "éxito" falso.
2. **Nutrientes con procedencia.** Todo valor nutricional sale de la tabla `foods` (o de una receta
   calculada desde sus ingredientes) y guarda su origen. La IA solo propone *qué* alimento y *cuánto*;
   no inventa calorías. Las estimaciones se marcan como estimaciones.
3. **Nada se registra sin confirmación del usuario** cuando viene de IA (foto, voz, texto).
4. **Salud y seguridad:** sin promesas de resultados, sin dietas extremas, sin castigar por comer.
   Respetar los pisos de calorías y los bloqueos por perfil de riesgo de `src/lib/nutrition/risk.ts`.
5. **Sin botones decorativos.** Si un control no puede funcionar todavía, no se muestra o se muestra
   deshabilitado con el motivo.
6. **Secretos solo en servidor.** Lo que use `serverEnv()` o `createSupabaseAdminClient()` lleva
   `import "server-only"`.

## Idioma
- UI en español de Perú, tono directo y amable, tuteo. Montos `S/ 12.50`, decimales con punto,
  fechas `lun 13 oct`. Usa `src/lib/format.ts`.
- Identificadores de código, tablas y columnas en inglés. Comentarios en español, breves, explicando
  el porqué.

## Estructura
```
src/app/(marketing)/…     sitio público (SSG cuando se pueda)
src/app/(auth)/…          ingreso, registro, recuperación
src/app/onboarding/…      onboarding previo al registro
src/app/app/…             área del usuario (requiere sesión)
src/app/admin/…           panel admin (requiere rol)
src/app/api/…             route handlers (webhooks, IA, exportaciones)
src/features/<modulo>/    lógica y UI de cada módulo:
    components/           componentes del módulo
    actions.ts            server actions ("use server"), validadas con Zod
    queries.ts            lecturas de servidor (import "server-only")
    schemas.ts            esquemas Zod compartidos cliente/servidor
    server/               lógica de servidor reutilizable (import "server-only"), usada por actions y rutas
    lib/                  funciones puras del módulo (sin I/O), con sus pruebas al lado
src/components/ui/        primitivas del sistema de diseño (no lógica de negocio)
src/components/app/       piezas compartidas del área de usuario (nav, FAB, encabezados)
src/lib/nutrition/        motor nutricional PURO (sin I/O), 100 % probado
src/lib/ai/  src/lib/billing/  src/lib/foods/   servicios con adaptadores
src/lib/supabase/         clientes (browser, server, admin, proxy)
src/lib/auth/             sesión, roles, guardas
src/lib/db/database.types.ts   tipos generados (`npm run db:types`), no editar a mano
supabase/migrations/      SQL versionado; supabase/seed/*.sql datos base (en orden alfabético)
tests/unit  tests/integration  tests/e2e
```
Las páginas en `src/app` son delgadas: leen datos con `queries.ts` y renderizan componentes de
`src/features`.

## Datos y Supabase
- **Lecturas**: en Server Components con `createSupabaseServerClient()` (RLS aplica).
- **Escrituras**: Server Actions en `src/features/*/actions.ts`. Cada acción:
  1) `const user = await requireUser()`; 2) valida la entrada con Zod; 3) escribe con el cliente de
  servidor (RLS); 4) `revalidatePath(...)`; 5) devuelve `ActionResult<T>` (`src/lib/action-result.ts`).
  Nunca confíes en un `user_id` que venga del cliente: usa `user.id`.
- **Interactividad en cliente** (búsqueda en vivo, IA, chat, temporizadores): client components con
  TanStack Query contra route handlers o server actions.
- `createSupabaseAdminClient()` (service role) solo en webhooks, eliminación de cuenta y métricas
  admin ya autorizadas con `requireRole`.
- Día del diario: `local_date` (`YYYY-MM-DD`) calculado con la zona horaria del perfil
  (`src/lib/dates.ts`). Instantes en `timestamptz` UTC.
- Unidades canónicas: energía kcal, masa g, volumen ml, alimentos **por 100 g**. Conversiones en
  `src/lib/nutrition/units.ts`.
- Los registros (`meal_log_items`, `meal_plan_items`) guardan copia de los nutrientes al momento.

## Autenticación y roles
`src/lib/auth/session.ts`: `getUser()`, `requireUser()`, `getProfile()`, `requireRole(role)`.
Roles en `user_roles`: `superadmin ⊃ admin ⊃ editor`; `professional` aparte. El usuario normal no
tiene fila. En SQL: `public.has_role('admin')`.

## Plan gratis / premium
`src/lib/billing/entitlements.ts`: `getEntitlements()` (usa la sesión actual, cacheada por petición) → `{ plan, isPremium, features, aiLimits, subscription }`.
En UI, `<PremiumGate feature="meal_plans">` muestra el contenido o la invitación a Premium.
Claves de feature: `ai_photo`, `ai_voice`, `ai_text`, `assistant`, `meal_plans`, `smart_recipes`,
`shopping_list`, `advanced_analytics`, `exports`.

## UI
- Primitivas de `@/components/ui/*` (estilo shadcn: Radix + cva + `cn()` de `@/lib/utils`).
- Iconos `lucide-react`. Animaciones `motion/react`, cortas (150–250 ms), respetando
  `prefers-reduced-motion`.
- Tokens de color en `src/app/globals.css` (`bg-background`, `text-foreground`, `bg-primary`,
  `text-muted-foreground`, `bg-card`, `border-border`, `ring-ring`…). No usar hex sueltos.
- Mobile-first: objetivos táctiles ≥ 44 px, safe areas (`pb-safe`), inputs a 16 px.
- Estados: cada lista tiene vacío, carga (`Skeleton`) y error. Formularios con React Hook Form + Zod.
- Accesibilidad: labels reales, `aria-*` donde haga falta, foco visible, contraste AA.

## Errores
- Acciones: `ActionResult` con `error.code` y mensaje en español para mostrar con `toast`.
- Route handlers: JSON `{ error: { code, message } }` con el status HTTP correcto (400, 401, 403,
  404, 409, 429, 503 para "no configurado").
- Logs sin datos de salud ni PII: ids y códigos, no contenido.

## Tests
- Unitarios con Vitest junto al código (`*.test.ts`) o en `tests/unit`.
- Integración (`tests/integration`, `npm run test:integration`) contra el Supabase local.
- E2E con Playwright (`tests/e2e`), viewport móvil 390×844.
- No agregar dependencias nuevas sin acordarlo: todo lo necesario ya está en `package.json`.
