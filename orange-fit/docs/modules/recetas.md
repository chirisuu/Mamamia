# Módulo recetas, planificador y lista de compras

Dueño de: `/app/recetas` (+ `/nueva`, `/[slug]`, `/[slug]/editar`), `/app/plan` (+ `/nuevo`, `/[id]`),
`/app/compras` (+ `/[id]`), `/compartido/plan/[token]`, `GET /api/plan/[id]/pdf`. Código en
`src/features/recipes/`, `src/features/planner/`, `src/features/shopping/`.

## Qué quedó funcional

### Recetas (gratis)
- **Catálogo** (`/app/recetas`): recetas publicadas y públicas + las propias (filtro explícito: el staff
  no ve borradores ajenos en el catálogo). Búsqueda sin tildes (título, descripción, etiquetas), filtros
  por tipo de comida, dieta (vegetariana acepta vegana; baja en carbohidratos acepta keto), **excluir
  alérgenos — por defecto los del objetivo activo** (`allergies` + `intolerances`; `?sin=` vacío = no
  excluir), tiempo total máximo (preparación + cocción), costo máximo por porción, favoritas, mías y
  orden (nombre, proteína por kcal, rapidez, costo, kcal). Estado en la URL (`q, comida, dieta, sin,
  tiempo, costo, favoritas, mias, orden`). Tarjetas con kcal y proteína por porción, tiempo, dificultad
  y costo por porción (`estimated_cost / servings`, referencial).
- **Para tu meta de hoy** (Premium `smart_recipes`, `<PremiumGate>`): kcal y proteína que faltan hoy
  (`nutrition_targets` vigente − `daily_nutrition_totals`), respetando alérgenos y patrón de dieta;
  porciones 0.5–2 en pasos de 0.25 que no se pasan de lo restante; reglas simples, sin IA. Con la meta
  cubierta solo lo informa (sin regañar); sin meta, enlaza a definirla.
- **Detalle** (`/app/recetas/[slug]`): imagen (`recipe-images/official/{slug}.webp`; sin imagen →
  placeholder de marca, nunca una foto genérica), porciones ajustables (`scaleRecipe`) que reescalan
  ingredientes (gramos y medida casera) y totales, nutrición por porción con la procedencia "calculada
  desde ingredientes" (fibra marcada como mínimo si falta el dato), pasos, tiempo, dificultad, etiquetas,
  alérgenos destacados (aviso si coinciden con los del objetivo), favorito, **Añadir al diario** (fecha
  hasta mañana, comida, porciones → `addItemsToMeal` kind `recipe`) y **Añadir al plan** (plan, día y
  comida; Premium `meal_plans`; nutrientes calculados en el servidor).
- **Crear/editar receta propia** (`/app/recetas/nueva`, `/app/recetas/[slug]/editar`): ingredientes con
  `GET /api/foods/search` (contrato 1), en gramos o en porciones caseras del alimento, nota opcional;
  nutrición en vivo (`recipeNutrition`); pasos ordenables; tipo de comida; dieta declarada
  (vegetariana/vegana/pescetariana); alérgenos; etiquetas. Etiquetas automáticas con las reglas del seed
  (`high_protein`, `low_carb`, `quick`). **Guardar borrador** (`draft`, solo el dueño) o **Enviar a
  revisión** (`pending_review` + `is_public`); publicar es del staff. Editar una publicada la devuelve a
  revisión (aviso en el formulario). Eliminar con confirmación. El servidor recalcula todo y valida que
  los alimentos sean visibles.

### Plan de comidas (Premium `meal_plans`)
- **Generar** (`/app/plan/nuevo`): `generatePlan` (motor determinista, nunca IA) con recetas publicadas
  + propias con ingredientes (`recipe_nutrition`), kcal y proteína de `getActiveTargets`, comidas por día
  del objetivo (2–6 → 3–5 del motor), alérgenos + intolerancias, `diet_pattern`, presupuesto semanal (si
  está en la moneda del perfil) y tiempo máximo opcional. Semilla aleatoria guardada en `params.seed`
  (reproducible). **Piso de seguridad**: si la meta guardada está bajo 1200/1500 kcal (y no la puso un
  profesional) se usa el piso y se avisa. **Bloqueo** (`risk.ts` → `blocks.autoPlans` o
  `requires_professional_review`): no se genera automáticamente (también lo rechaza el servidor); se
  puede armar a mano.
- **Diagnóstico en vivo**: kcal y proteína por día contra la meta (desviación %, ±10 %), promedio, huecos
  vacíos, costo referencial vs presupuesto proporcional a los días, recetas elegibles/excluidas. Sin rojo
  ni castigos.
- **Edición** (cliente, se guarda con "Guardar"): vista por día y comida + resumen semanal; cambiar
  receta por alternativas del mismo tipo de comida y kcal parecidas; porciones (0.25–5) o gramos;
  quitar; **regenerar un día** (semilla derivada, evita repetir de más); planificación manual (añadir
  receta o alimento a un hueco). Al guardar, el servidor recalcula los nutrientes desde la base
  (`recipe_nutrition` / `foods`) y reemplaza los ítems (inserta los nuevos y luego borra los anteriores).
  `meal_plan_items.position = hueco × 10 + orden`.
- **Estados**: borrador → activar (deja un solo plan activo; el anterior pasa a archivados), archivar,
  volver a borrador; lista de planes; "Hoy en tu plan" en `/app/plan` con el plan activo.
- **Registrar esta comida** → `addItemsToMeal` con `source 'plan'` (recalcula desde la base).
- **PDF** (`GET /api/plan/[id]/pdf`, Premium `exports`): pdf-lib + Helvetica, tabla por día con totales,
  promedio y aviso; todo texto pasa por `toWinAnsi` (conserva tildes/ñ/¿¡, reemplaza ≥, emojis, etc.).
  401 sin sesión, 403 sin Premium, 404 si no es tuyo, 503 sin Supabase configurado.
- **Compartir** con consentimiento explícito (casilla obligatoria, validada con Zod en el servidor):
  token `crypto.randomUUID()` sin guiones; página pública `/compartido/plan/[token]` vía
  `rpc get_shared_plan` (sin datos personales; `noindex`, `no-referrer`); **revocar** borra token y
  `shared_at`. Revocar y eliminar funcionan aunque ya no tenga Premium.

### Lista de compras (Premium `shopping_list` para crear)
- Desde un plan guardado: `ingredientsFromPlan` + `buildShoppingList` (consolida por alimento,
  categorías, unidades de compra redondeadas hacia arriba) con `reference_prices` (el más reciente en la
  moneda del perfil). Peso de la unidad de compra: gramos del nombre del precio ("bolsa 600 g") → porción
  con la misma palabra de envase → porción "unidad"; si no hay dato, el ítem queda **sin precio**.
  Presupuesto = presupuesto semanal del plan × días / 7.
- Marcar comprado (optimista), editar cantidad/unidad/precio (precio escrito → `price_source 'user'`),
  agregar ítem manual, quitar ítem, nombre y presupuesto de la lista, total vs presupuesto, conteo de
  ítems sin precio y la marca **"precio referencial, no en tiempo real"**. Compartir como texto
  (`navigator.share` o copiar). Ver/editar/borrar listas existentes no exige Premium.

## Contratos
- Consumidos tal cual: `GET /api/foods/search` (contrato 1; errores 401/429/503 con mensaje real),
  `addItemsToMeal` (única escritura al diario), `getActiveTargets`/`getActiveGoal`, `PremiumGate`,
  `hasFeature`, `get_shared_plan`.
- No se cambió ningún contrato.

## Requiere credenciales / servicios
Nada propio. Depende del Supabase local/remoto y de `/api/foods/search` (módulo alimentos) para buscar
ingredientes en el formulario de recetas y en "Añadir alimento" del plan.

## Decisiones
- Categoría de compra por **palabras clave del nombre** (`shopping/lib/categorize.ts`): `foods` no tiene
  columna de categoría. Lo desconocido va a "Otros".
- **Recetas propias sin costo** (`estimated_cost = null`): no se inventa; el costo del plan queda parcial
  y se dice.
- El tiempo máximo del planificador usa el **tiempo total** (preparación + cocción).
- Un plan sin guardar vive en el cliente; "Registrar esta comida", PDF, compartir y lista de compras
  piden guardar antes.
- Las recetas de un plan cuya receta se borró quedan como "Receta no disponible" (FK `set null`) y se
  quitan al volver a guardar (se avisa).

## Pendientes / mejoras
- Columna de categoría en `foods` (módulo alimentos) para no depender de palabras clave.
- `/app/agregar` enlaza a `/app/recetas` sin `fecha`/`comida`; el diálogo "Añadir al diario" usa hoy y la
  comida según la hora (se puede cambiar).
- Imágenes de recetas: el staff debe subir `official/{slug}.webp` y fijar `image_path`.
- Publicar recetas de usuarios (admin): exige que todos sus ingredientes sean públicos (trigger 23514).
- Sin E2E propios; no se ejecutó `next dev`/`next build` (regla del trabajo en paralelo).

## Pruebas
- Unitarias (85): `recipes/lib/*.test.ts` (adaptadores filas → tarjeta y → entrada del planificador,
  costo por porción, URL de imagen, filtros y URL, recomendaciones, escalado, nutrición en vivo,
  etiquetas automáticas, slugs, formulario), `planner/lib/*.test.ts` (piso de seguridad, params,
  generación determinista dentro de ±10 %, regenerar día, alternativas, porciones, posiciones,
  diagnóstico, **PDF con tildes y ñ**, `toWinAnsi`, plan compartido), `shopping/lib/build.test.ts`
  (categorías, peso de unidad, precios, lista consolidada con y sin precio, texto para compartir).
- Integración (`tests/integration/recetas.test.ts`, 11): receta propia invisible para otro usuario
  (catálogo, slug, id, ingredientes), revisión, favoritos, registrar receta, generar y **guardar plan**
  con nutrientes del servidor, bloqueo de planes automáticos, recetas privadas ajenas rechazadas,
  activar + **registrar comida del plan**, **generar lista de compras** y editarla, **token de compartir
  y revocar** (anónimo, sin datos personales), borrar receta.
