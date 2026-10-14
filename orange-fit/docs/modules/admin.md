# Módulo admin — panel `/admin`

Dueño de: `src/app/admin/**` (salvo `layout.tsx`, compartido), `src/features/admin/**`,
`supabase/migrations/20261013100801_admin_panel.sql`, `tests/integration/admin.test.ts`.

Reglas que cumple todo el panel:
- **Rol en cada página y cada acción.** El layout exige `editor`, pero además cada `page.tsx` llama a
  `requireRole(...)` y cada Server Action pasa por `runAdminAction(role, schema, input, op)`
  (`server/action.ts`): `requireRole` → Zod → operación con el cliente de la **sesión** (RLS del staff) →
  `revalidatePath` → `ActionResult`. Sin rol responde 404 (no revela el panel); sin sesión, a `/ingresar`.
- **Auditoría.** Toda mutación termina en `log_admin_action(action, target_table, target_id, metadata)`
  (`server/db.ts → logAdminAction`). La metadata lleva solo ids, códigos y conteos (nunca datos de salud ni
  valores de configuración). Si la auditoría falla después de guardar, la acción lo dice (`AUDIT_FAILED`).
- **Service role** (`createSupabaseAdminClient`) solo después de `requireRole`: lista de cuentas
  (`auth.admin.listUsers` / búsqueda por correo), correos del staff en la auditoría e importación USDA.
- **Sin PII ni datos de salud**: usuarios = correo, alta, último ingreso, plan y roles; errores = mensaje,
  ruta, referencia, navegador y "con/sin sesión"; IA = agregados por mes/tipo/modelo/estado.

Roles: `superadmin ⊃ admin ⊃ editor`.
| Sección | Rol | Ruta |
|---|---|---|
| Dashboard (pendientes + integraciones; métricas de negocio solo admin) | editor | `/admin` |
| Usuarios (lectura; otorgar/quitar roles solo superadmin) | admin | `/admin/usuarios` |
| Alimentos: catálogo, nuevo/editar, verificación, duplicados, importar USDA, precios referenciales | editor | `/admin/alimentos/**` |
| Recetas: moderación y recetas oficiales con imagen | editor | `/admin/recetas/**` |
| Contenidos (FAQ, legales, bloques, artículos) | editor | `/admin/contenidos/**` |
| Planes y precios | admin | `/admin/planes` |
| Uso de IA | admin | `/admin/ia` |
| Configuración | admin | `/admin/configuracion` |
| Auditoría | admin | `/admin/auditoria` |
| Errores | admin | `/admin/errores` |

## Qué quedó funcional
- **Dashboard**: colas de trabajo (alimentos sin verificar, recetas en revisión, contenidos en borrador,
  errores nuevos) enlazadas a su sección; `admin_metrics()` en `StatTile` (usuarios, nuevos, activos 7/30 d,
  Premium pagando/en prueba, conversión, ingresos del mes por moneda, cancelaciones, solicitudes y costo de IA)
  + 3 gráficos Recharts con tabla accesible; estado de `integrationStatus()` (configurado / pendiente, sin
  mostrar valores).
- **Usuarios**: paginado (25) con `auth.admin.listUsers`; búsqueda por correo con el mismo endpoint
  (`GET /auth/v1/admin/users?filter=`). Plan vigente con el criterio de `is_premium`. Superadmin otorga/quita
  `editor`, `admin`, `professional` con diálogo de confirmación; `superadmin` solo por SQL (Zod lo rechaza y el
  RLS de `user_roles` también).
- **Alimentos**: catálogo público (+ los retirados sin dueño; los alimentos propios de cada persona no se
  listan) con búsqueda por nombre o código de barras y filtros de fuente, verificación y visibilidad.
  Editor con macros por 100 g (obligatorios; vacío ≠ 0), opcionales, densidad, porciones caseras (una
  predeterminada), marca (se reutiliza por nombre normalizado), países, **procedencia obligatoria**
  (fuente + referencia, URL y licencia opcionales), verificación y publicación; aviso 4/4/9 si la energía
  no cuadra con los macros. No deja despublicar un alimento usado por recetas publicadas (pide fusionarlo).
  Cola de verificación (`unverified → curated/verified/rejected` con `verified_by/verified_at`).
  Duplicados con `findDuplicateCandidates` (contrato 4, con la sesión del staff) y tres niveles de parecido;
  **fusión** atómica con `admin_merge_foods` (reapunta `recipe_ingredients`, favoritos —sin duplicar—,
  plantillas, planes, listas de compras y precios; mueve el código de barras si el conservado no tenía;
  el duplicado queda `rejected`, sin publicar y sin dueño; el diario no se toca). Importación USDA con
  `importUsdaFoods(createSupabaseAdminClient(), …)` (contrato 3) por búsqueda o por FDC ID, con resultado
  real (nuevos/actualizados/omitidos/errores); sin `FDC_API_KEY` la página lo dice y la acción responde
  `USDA_NOT_CONFIGURED` "pendiente de configurar". Precios referenciales: CRUD con fuente y fecha, vínculo
  opcional a un alimento público.
- **Recetas**: lista por estado (en revisión con contador) y origen. Receta de usuario: detalle de solo
  lectura (ingredientes con aviso si alguno no es público, pasos, nutrición por porción de
  `recipe_nutrition`, etiquetas) y moderación: **publicar** (bloqueado si usa alimentos no públicos) o
  **rechazar con motivo** (obligatorio, ≥ 10 caracteres). El autor recibe una notificación con el motivo
  (trigger `notify_recipe_review`). Receta oficial: editor completo (título, descripción, porciones,
  tiempos, dificultad, costo, comidas, dieta, alérgenos, etiquetas, ingredientes del catálogo público con
  medida casera y nota, pasos ordenables, borrador/publicada) con vista previa de nutrición, y **subida de
  imagen**: recorte 4:3 y WebP en el navegador (≤ 900 KB por el límite de 1 MB de las Server Actions) y
  normalización en el servidor con `sharp` a WebP 1200×900 sin metadatos, en
  `recipe-images/official/{slug}.webp` + `recipes.image_path` (como pide `docs/IMAGE_PROMPTS.md`). Quitar
  imagen borra el archivo.
- **Contenidos**: CRUD de `content_pages` por tipo, publicar/despublicar, subir/bajar (renumera 10, 20, 30…),
  borrar con confirmación. Editor markdown con vista previa en vivo (lado a lado en escritorio, alternada
  en móvil) usando `lib/markdown.tsx`: árbol propio pintado con React, **sin `dangerouslySetInnerHTML`**,
  enlaces solo http(s)/mailto/rutas internas/anclas, sin imágenes. Cada tipo dice dónde se ve
  (`/faq`, `/legal/{terminos|privacidad|datos-de-salud}`; `landing_block` y `article` hoy no los lee
  ninguna página, y la UI lo dice).
- **Planes y precios**: nombre, descripción, orden, activo, funciones de pago (checkboxes de
  `PREMIUM_FEATURES`; las funciones base se conservan) y cupos mensuales de IA por tipo. Precios: periodo,
  moneda, monto en céntimos con vista en soles/dólares, días de prueba (0 = `default_trial_days`),
  `stripe_price_id` (`price_…`), `mercadopago_plan_id` (la UI aclara que hoy no se usa), activo. Conflictos
  (precio activo repetido, ids de Stripe/MP repetidos) con mensaje claro.
- **Uso de IA**: `admin_ai_usage(months)` (3/6/12 meses): solicitudes, costo estimado, tasa de error
  (con error ÷ (correctas + con error)) y de rechazo (sin cupo + sin configurar ÷ total); gráficos por mes
  de solicitudes y costo; tablas por tipo, modelo y estado; códigos de error más frecuentes. Sin contenido.
- **Configuración**: `app_name`, `support_email`, `default_trial_days`, `maintenance_banner` y
  `feature_flags`, validado con Zod (cliente y servidor). Sección **Medios de pago** con
  `feature_flags.payments_stripe` y `feature_flags.payments_mercadopago` (mismas claves que
  `PROVIDER_FLAG` de `src/lib/billing/catalog.ts`; un test lo garantiza): muestran si hay credenciales y si
  están encendidos; no se pueden borrar (quitar la clave equivaldría a encender el proveedor) y si no llegan
  en el formulario se conserva el valor guardado. Los demás interruptores dicen "Sin efecto todavía" cuando
  ninguna parte de la app los lee. La auditoría guarda qué claves y qué interruptores cambiaron (no valores).
  "Sin valor" se guarda como `""` (`value` es NOT NULL); `getAppSettings` lo trata como vacío.
- **Auditoría**: paginada (50) con filtros por grupo de acción, tabla, autor (correo del staff) y rango de
  fechas (hora de Lima). **Errores**: pestañas nuevo / en revisión / resueltos / todos con contadores,
  búsqueda por ruta y cambio de estado.
- Estados de carga (`loading.tsx` con `Skeleton` en cada sección y editor), vacíos (`EmptyState`) y error
  (`/admin/error.tsx` con `retry()`); filtros por URL (formularios GET, funcionan sin JS); botones de 44 px.

## Migración `20261013100801_admin_panel.sql` (aplicada y re-aplicada, idempotente)
1. `admin_ai_usage(months int default 6) → jsonb` (security definer, solo admin o service role): filas
   `{month, kind, model, status, requests, cost_usd, tokens_input, tokens_output, avg_latency_ms}` y
   `errors [{status, error_code, requests}]`. Necesaria porque `ai_analysis_requests` solo la lee su dueño.
2. `admin_merge_foods(keep_id, drop_id) → jsonb` (security definer, editor+): fusión atómica (ver arriba).
   Necesaria porque favoritos, plantillas, planes y listas son "solo del dueño" por RLS.
3. `recipes.review_note text` (≤ 500) + trigger `recipes_notify_review` (`notify_recipe_review()`): aviso al
   autor cuando el staff publica o rechaza su receta (el staff no puede insertar notificaciones ajenas).
Las RPC nuevas se llaman con `rpcUntyped` (`server/db.ts`) porque los tipos no se regeneraron; `review_note`
se tipa localmente (`AdminRecipeRow`).

## Requiere credenciales o configuración
- `SUPABASE_SERVICE_ROLE_KEY`: lista/búsqueda de usuarios, correos del staff en la auditoría e importación
  USDA. Sin ella: Usuarios muestra "pendiente de configurar"; la auditoría muestra ids en vez de correos.
- `FDC_API_KEY` (gratis en api.data.gov): importación USDA. Sin ella: "pendiente de configurar".
- Stripe / Mercado Pago: el panel edita precios e interruptores igual; el cobro depende de las claves (ver
  `docs/modules/pagos.md`). La semilla trae `payments_mercadopago = false`: se enciende en Configuración.
- Primer superadmin: por SQL (`insert into public.user_roles (user_id, role) values ('<uuid>', 'superadmin');`).

## Qué falta / límites conocidos
- `AdminShell` oculta al editor las secciones exclusivas de admin (y si entra por URL, responden 404).
- La vista previa de contenidos usa el renderer del panel (`features/admin/lib/markdown.tsx`); el sitio público
  usa el de `features/marketing/markdown.tsx`. Ambos son seguros, pero podrían diferir en detalles de estilo.
- No se borra un alimento del catálogo desde el panel (se rechaza o se fusiona): el diario y las recetas lo
  referencian. Tampoco hay creación/borrado de planes (`free`/`premium` vienen de la semilla).
- Búsqueda de usuarios: solo por correo (como pide el contrato); sin filtros por plan o rol.
- Verificado después en la integración: `next build` pasa y el recorrido de humo E2E cubre todas las pantallas del panel.

## Pruebas
- Unitarias (`npx vitest run src/features/admin`, 52): esquemas Zod (configuración, alimento, planes y precios,
  contenidos, moderación, receta oficial, roles, fusión, USDA, precios referenciales), markdown seguro
  (`javascript:`/`data:`/esquemas disfrazados, HTML crudo escapado, atributos no inyectables, enlaces externos
  con `rel`), interruptores de pagos alineados con `PROVIDER_FLAG`, métricas y uso de IA (tasas, meses en hora
  de Lima), helpers de servidor (filas de configuración, conservación de interruptores de pagos, plan
  vigente, reordenar, filtros de auditoría) y formularios en jsdom (medios de pago, vista previa sin HTML,
  validación de alimento).
- Integración (`npx vitest run --config vitest.integration.config.ts tests/integration/admin.test.ts`, 12):
  sin sesión → ingreso; usuario normal → 404 en layout, páginas y acciones; editor no cambia configuración,
  planes, precios ni roles (y el RLS tampoco lo deja); admin cambia configuración e interruptores de pagos y
  planes/precios con auditoría; superadmin otorga y quita roles (admin no puede); alimentos (crear, verificar,
  fusionar con reapuntado real); USDA sin clave; moderación con aviso al autor; receta oficial + imagen WebP
  1200×900 en Storage; contenidos; errores; render de 15 páginas con datos reales. Restaura configuración y
  plan, y borra usuarios, datos, archivos y auditoría de prueba.
