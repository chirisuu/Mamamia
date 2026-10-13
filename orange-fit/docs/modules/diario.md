# Módulo diario (Inicio + diario alimentario)

Dueño de: `/app` (Inicio), `/app/diario`, `/app/diario/[fecha]`, `/app/agregar` (índice),
`/app/agregar/buscar`, `/app/alimentos` (+ `/nuevo`, `/[id]`). Código en `src/features/diary/` y
`src/features/dashboard/`.

## Qué quedó funcional

### Inicio (`src/app/app/(inicio)/page.tsx`)
La página vive en el grupo `(inicio)` para que su `loading.tsx` (esqueleto del dashboard) no se
muestre al navegar a rutas de otros módulos bajo `/app`. La URL sigue siendo `/app`.

- Saludo con `display_name` y fecha/hora **en la zona del perfil** (`localDateInTz`, `localHourInTz`).
- Anillo calórico (`ProgressRing`) con **desglose visible** (`lib/budget.ts` sobre `dailyBudget`):
  meta base, ejercicio (fila solo si `profiles.count_exercise_calories`), ajustes, consumido
  (`daily_nutrition_totals`) y restante; «¿Cómo se calcula?» muestra la explicación del motor (si el
  ejercicio no se suma, se dice por qué). Sin meta → «Meta pendiente de definir» + enlace a
  `/app/perfil/metas`.
- Barras de proteína, carbohidratos, grasa y fibra vs meta (fibra marcada como mínimo si falta el dato).
- Agua del día vs `nutrition_targets.water_ml` (→ `/app/agua`); peso: último, promedio de 7 días y
  tendencia (`weightTrend`, con su confianza) (→ `/app/progreso`). Con antecedente de TCA
  (`user_goals.health_flags`) no se muestran números de peso ni recordatorios de pesaje.
- Rachas de registro y de metas (`computeStreaks`, sin castigo; «registra hoy para sumar»).
- Accesos rápidos (buscar, foto, voz, código, agua, ayuno).
- Recordatorios: notificaciones sin leer (`read_at is null`, ya vencidas) + calculados honestos
  (`lib/reminders.ts`): solo la comida principal que ya pasó sin registro (desayuno ≥ 10 h, almuerzo
  ≥ 15 h, cena ≥ 21 h, hora local), agua < 50 % después de las 14 h, pesaje con ≥ 7 días, meta faltante.
- Sugerencias por reglas (`lib/recommendations.ts`, máx. 3, etiquetadas «Sugerencia» y con aviso de
  que no reemplazan a un profesional): registro muy bajo de noche (no quedarse con poco), proteína baja
  hoy/ayer (enlaza recetas publicadas con más proteína por kcal desde `recipe_nutrition`), fibra baja
  (solo si el dato es completo), sodio > 2000 mg (OMS), constancia.
- Gráfico semanal (Recharts, un solo eje kcal): barras consumido + línea de meta del día; los días sin
  registro no se dibujan como 0; tabla `sr-only` equivalente.
- Usuario nuevo: tarjeta de bienvenida con la acción real; gráfico con texto vacío.

### Diario (`/app/diario/[fecha]`)
- `/app/diario` redirige a hoy (zona del perfil). Fechas inválidas → 404; más allá de mañana →
  redirige a mañana. Navegación ← → y selector de fecha (calendario nativo, máx. mañana).
- Secciones Desayuno, Almuerzo, Cena, Snacks (siempre) + comidas personalizadas (crear con nombre,
  nombre repetido el mismo día → aviso; eliminar).
- Cada ítem: nombre, marca, cantidad/unidad (+ gramos), kcal, macros, procedencia
  (`lib/provenance.ts`: alimento vigente → `provenanceLabel`; si no, el texto guardado; IA con
  confianza; manuales como estimación). Acciones: editar cantidad (hoja con porciones de la base;
  el servidor recalcula desde `foods` por 100 g o `recipe_nutrition` por porción; manuales/huérfanos
  se escalan en proporción), mover a otra comida, duplicar, favorito, ver receta, eliminar.
- Acciones de comida: copiar a otro día (atajos hoy/mañana o fecha), guardar como plantilla (los
  manuales se omiten y se avisa), aplicar plantilla (y borrar plantillas), vaciar.
- Totales del día vs la meta vigente en esa fecha, con fibra, azúcar y sodio; «≥» cuando algún ítem
  no trae el dato (`summarizeItems` → `sumNutrients`).

### Agregar
- `/app/agregar`: los métodos de registro (buscar, código, foto, voz, texto, receta, ingreso manual)
  + agua/actividad/ayuno/mis alimentos; chips de comida; `?fecha=&comida=&nombre=` se propagan.
- `/app/agregar/buscar`: búsqueda en vivo (TanStack Query, debounce 250 ms) contra
  `GET /api/foods/search?q=&limit=20` (contrato 1), recientes (últimos alimentos distintos, con la
  última cantidad usada) y favoritos. Errores 401/429/503/otros con mensaje real y reintento. Sin
  resultados → «Crear alimento propio» (`/app/alimentos/nuevo?nombre=…&volver=…`).
- **PortionPicker** reutilizable (`src/features/diary/components/portion-picker.tsx`): porciones de la
  base, gramos o ml (solo con densidad), comida destino (por defecto según la hora local), fecha
  (máx. mañana), vista previa con `scaleNutrients` y procedencia, favorito. Registra con
  `logFoodAction` → `addItemsToMeal` (`source` configurable: `search`, `barcode`, `manual`, `plan`).
  Para usarlo con la respuesta de la API: `toPickerFood(food)` de `src/features/diary/lib/picker-food.ts`.
- Ingreso manual rápido (nombre + kcal + macros) → `addItemsToMeal` kind `manual` (queda como
  estimación ingresada por el usuario).

### Alimentos propios (`/app/alimentos`)
- Lista de mis alimentos y favoritos (alimentos + recetas favoritas); tocar uno abre el PortionPicker.
- Crear/editar (`OwnFoodForm`, RHF + Zod): nombre, marca (busca por nombre normalizado o la crea),
  código de barras opcional, valores por 100 g **o por porción** (se convierten a 100 g y se validan
  contra los checks de la base: kcal ≤ 900, macros ≤ 100 g, P+C+G ≤ 105 g), porciones caseras (una
  por defecto). Siempre `is_public=false`, `source='user'`, `verification_status='unverified'`.
- Eliminar: lo registrado en el diario se conserva (copia de nutrientes); si el alimento se usa en una
  receta, se explica que hay que quitarlo de la receta (FK 23503).
- `/app/alimentos/nuevo` acepta `?nombre=`, `?codigo=` (6–14 dígitos) y `?volver=` (solo rutas de
  registro internas; ver `lib/return-to.ts`). Al guardar vuelve con `&q=<nombre>`.

## Arquitectura
- `server/log-items.ts` (compartido): única puerta para AGREGAR ítems. `server/diary-ops.ts` usa
  `addItemsToMeal` para duplicar, copiar y aplicar plantillas (recalcula desde la base); solo los
  ítems cuyo alimento/receta ya no existe se copian tal cual (copia de servidor, con su procedencia).
- `server/*.ts` y `queries.ts` reciben el cliente con sesión (RLS) y filtran por `user_id`: un id
  ajeno es `NOT_FOUND`. `actions.ts`: `requireUser` → Zod → operación → `revalidatePath("/app","layout")`
  → `ActionResult`. Fechas validadas contra «hoy» del perfil (pasado y hasta mañana).
- Lógica pura y probada en `src/features/{diary,dashboard}/lib/*`.

## Requiere credenciales / servicios
Nada propio. Depende de:
- `GET /api/foods/search` (módulo alimentos). Si no responde, el buscador lo dice (no hay resultados falsos).
- Rutas de otros módulos enlazadas: `/app/agua`, `/app/progreso`, `/app/ayuno`, `/app/actividad`,
  `/app/notificaciones`, `/app/recetas[/slug]`, `/app/perfil/metas`, `/app/agregar/{foto,voz,texto,codigo}`.

## Supuestos y pendientes
- `exercise_logs.energy_kcal` se toma como **kcal netas** (según el encargo). Si seguimiento guarda
  brutas, hay que convertir (`neto = bruto × (MET−1)/MET`) en `dashboard/queries.ts`.
- «Ajustes» del presupuesto: no existe tabla para ajustes manuales por día; hoy siempre es 0 y se
  muestra «Sin ajustes para hoy». Si se quiere, hace falta una tabla nueva (no creada).
- Días anteriores a la primera meta usan la primera meta para la racha de metas y la vista del diario.
- Las plantillas guardan gramos (no la porción casera elegida): al aplicarlas se registran en gramos.
- No hay paginación en «mis alimentos» ni en recientes (150 últimos ítems → 12 alimentos distintos).
- Sin E2E (Playwright) propios todavía; no se ejecutó `next dev`/`next build` (regla del trabajo en paralelo).

## Pruebas
- Unitarias: `src/features/diary/lib/*.test.ts`, `src/features/dashboard/lib/*.test.ts` (presupuesto y
  desglose, comida por hora, recordatorios, reglas de sugerencias, series/rachas, porciones,
  procedencia, conversión a 100 g, destino por URL, retorno seguro) y de componentes
  (`portion-picker`, `food-search`, `diary-meals`, tarjetas de Inicio) con jsdom.
- Integración: `tests/integration/diario.test.ts` (registrar, editar recalcula, recetas, manuales,
  mover, duplicar, copiar a otro día, plantillas, vaciar, comidas personalizadas, favoritos, alimentos
  propios, `daily_nutrition_totals` cuadra, aislamiento entre usuarios) y
  `tests/integration/diario-dashboard.test.ts` (presupuesto con y sin ejercicio, agua, peso, rachas,
  semana, recordatorios por hora local, usuario nuevo).
