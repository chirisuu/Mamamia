# Procedencia de los datos — alimentos, recetas y precios

Este documento explica de dónde salen los valores nutricionales, las recetas oficiales y los precios
referenciales que se cargan desde `supabase/seed/`, por qué **todos** entran como no verificados y
cómo se revisan en el panel. Va de la mano con la regla 2 de `docs/CONVENTIONS.md` (nutrientes con
procedencia; las estimaciones se marcan como estimaciones).

## 1. Qué hay en `supabase/seed/`

| Archivo | Contenido |
|---|---|
| `10_foods.sql` | 196 alimentos en `public.foods` (159 genéricos y 37 platos peruanos) y 276 porciones caseras en `public.food_portions` (una por defecto por alimento). |
| `20_recipes.sql` | 36 recetas oficiales en `public.recipes` y 290 ingredientes en `public.recipe_ingredients`. |
| `30_reference_prices.sql` | 79 precios referenciales en `public.reference_prices` (Lima, PEN). |

Todos los alimentos: `source = 'curated'`, `verification_status = 'unverified'`, `is_public = true`,
`created_by = null`. Ninguno se marca `verified` desde un seed.

**Cómo cargarlos** (después de las migraciones; orden 10 → 20 → 30):

- En local entran solos con `supabase db reset` (la config carga `./seed/*.sql` en orden alfabético,
  después de `00_base.sql`).
- En un proyecto en la nube (`supabase db push` no carga semillas): `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed/10_foods.sql`
  y luego 20 y 30 (ver `docs/DEPLOYMENT.md`).

Cada archivo va en una transacción y empieza con una guarda: si ya se cargó, aborta con un mensaje y no
escribe nada (no son idempotentes a propósito, para no duplicar filas).

**Validación sin base de datos:** `node scripts/check-seed.mjs` revisa columnas contra este contrato y
contra las migraciones, duplicados, referencias entre archivos, coherencia de macros, rangos y etiquetas
de recetas. Sale con código 1 si encuentra errores.

## 2. De dónde salen los valores

Cada fila de `foods` guarda su procedencia en `source_ref` (texto), `source_url` y `license`.

| Tipo | Filas | `source_ref` empieza con | `license` |
|---|---|---|---|
| USDA | 117 | "Valor aproximado basado en USDA FoodData Central (SR Legacy), «descripción»…" | Dominio público (USDA FoodData Central, CC0 1.0) |
| Análogo USDA | 31 | "Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), «descripción»: motivo…" | Dominio público (USDA FoodData Central, CC0 1.0) |
| Estimación propia | 10 | "Estimación propia aproximada (motivo); sin valor de tabla confirmado…" | — (no se usó una fuente) |
| TACO (Brasil) | 1 | "Valor aproximado basado en TACO 4.ª ed. (NEPA-UNICAMP, Brasil)…" | Uso con cita de la fuente (TACO, NEPA-UNICAMP) |
| Plato peruano | 37 | "Estimación por receta estándar — pendiente de verificación" | — |

- **USDA**: los valores por 100 g se escribieron a partir del conocimiento previo de USDA FoodData Central
  (base SR Legacy), **sin consultar la API al generar el seed**, y pueden estar redondeados o venir de otra
  versión de la tabla. Por eso `source_ref` lleva la descripción en inglés de SR Legacy (para encontrar la
  entrada exacta) y no un FDC ID: no se inventaron identificadores.
- **Análogo USDA**: alimentos peruanos sin entrada propia en USDA (choclo, ají amarillo, rocoto, frejol
  canario, queso andino, granadilla, jurel, caballa, pota…). Se tomó el alimento más parecido y el
  motivo queda escrito en `source_ref` (lista en el apéndice B). Son los primeros candidatos a revisar con
  la TPCA.
- **Estimación propia**: alimentos andinos o amazónicos de los que no se tenía un valor de tabla confiable
  (lista en el apéndice B). Son las filas menos confiables del catálogo.
- **TACO**: solo la yuca sancochada (USDA no tiene yuca cocida).
- **Platos peruanos** (`food_type = 'dish'`): no vienen de una tabla. Se calcularon con una **receta
  estándar** armada con los alimentos de este mismo seed (apéndice A): suma de ingredientes ÷ peso final
  del plato (después de cocción, evaporación o absorción) × 100. No se descuenta la grasa que queda en la
  sartén al freír ni lo que queda en líquidos que se descartan. Las recetas reales varían mucho entre casas
  y restaurantes; la descripción de cada plato dice qué incluye (p. ej. "sin arroz").
- **Valores en null**: si no se conocía un micronutriente (fibra, azúcar, grasa saturada, sodio) con
  confianza razonable, se dejó en `null` en vez de adivinarlo. En los platos, un campo queda en `null` si
  los ingredientes sin dato aportan más del 15 % de los carbohidratos (fibra, azúcar) o de la grasa (grasa
  saturada), o si hay un ingrediente salado sin dato de sodio (aceituna, galleta, salchicha, atún…). El
  sodio propio de ingredientes frescos sin dato se contó como 0, así que el sodio de un plato puede estar
  un poco por debajo del real.
- **`country_codes`**: `{PE}` para alimentos y platos propios del Perú; `{PE,BO,EC}` para alimentos andinos;
  `{PE,BO,CL,CO,EC,MX,AR}` para genéricos comunes en la región. Indica dónde es habitual, no dónde se midió.
- **Porciones**: medidas caseras aproximadas (taza de 240 ml, cuchara de 15 ml, unidades medianas del
  mercado peruano). Conviene pesarlas al revisar cada alimento.

## 3. Por qué todo está `unverified`

1. Ningún valor se cotejó contra la fuente original al momento de cargarlo (no hubo consulta a la API de
   USDA, a la TPCA ni a etiquetas).
2. Varios alimentos peruanos se aproximaron con análogos o con estimaciones propias.
3. Los platos son cálculos sobre una receta supuesta, no análisis de laboratorio.
4. Las variedades locales (papa nativa, choclo andino, quesos artesanales) y las marcas cambian la
   composición.

La app debe tratarlos como **aproximados**: mostrar que el valor no está verificado (y que un plato es una
estimación) y no presentarlos como medidos.

## 4. Cómo verificar

### 4.1 USDA FoodData Central (alimentos genéricos)

- **Clave**: variable de servidor `FDC_API_KEY` (ya declarada en `src/lib/server-env.ts`; nunca en el
  cliente). Se pide gratis en https://fdc.nal.usda.gov/api-key-signup.html (es una clave de api.data.gov,
  con límite por hora).
- **Buscar** la descripción que figura en `source_ref`:
  `GET https://api.nal.usda.gov/fdc/v1/foods/search?api_key=$FDC_API_KEY&query="Quinoa, cooked"&dataType=SR%20Legacy&pageSize=5`
- **Detalle**: `GET https://api.nal.usda.gov/fdc/v1/food/{fdcId}?api_key=$FDC_API_KEY`. Los valores vienen
  por 100 g. Nutrientes que usamos (número de nutriente → id): energía kcal 208 → 1008; proteína 203 → 1003;
  grasa total 204 → 1004; carbohidratos por diferencia 205 → 1005; fibra 291 → 1079; azúcares totales
  269 → 2000; grasa saturada 606 → 1258; sodio 307 → 1093.
- SR Legacy ya no se actualiza (última versión 2018). Si existe el mismo alimento en *Foundation Foods* con
  análisis más reciente, se puede usar, anotándolo.
- **Al verificar**: corrige los valores y deja en `source_ref` algo como
  `USDA FoodData Central, SR Legacy, FDC ID 123456, "Quinoa, cooked", consultado 2026-10-20`, en
  `source_url` `https://fdc.nal.usda.gov/food-details/123456/nutrients` y en `license`
  `Dominio público (USDA FoodData Central, CC0 1.0)`. Si los valores quedan idénticos a FDC, `source` puede
  pasar a `usda`. USDA pide citarlo como "U.S. Department of Agriculture, Agricultural Research Service.
  FoodData Central".

### 4.2 Open Food Facts (productos con código de barras)

Solo para productos de marca (`food_type = 'branded'`), no para genéricos.

- `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json` enviando un `User-Agent` que
  identifique a la app (p. ej. `OrangeFit/1.0 (correo de soporte)`).
- Campos útiles (`product.nutriments`): `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`,
  `fat_100g`, `fiber_100g`, `sugars_100g`, `saturated-fat_100g`, `sodium_100g` (en gramos: ×1000 para
  `sodium_mg`; si solo hay `salt_100g`, sodio ≈ sal ÷ 2,5). Revisa que los valores sean "por 100 g" y no por
  porción.
- **Licencia**: la base de datos es **ODbL 1.0** (contenidos individuales bajo DbCL; imágenes CC BY-SA).
  Exige **atribución** visible ("Datos de Open Food Facts, licencia ODbL") y, si se distribuye públicamente
  una base derivada, que se comparta con la misma licencia. Por eso las filas de OFF deben quedar
  identificables: `source = 'open_food_facts'`, `license = 'ODbL 1.0 (Open Food Facts)'`,
  `source_url` = página del producto, `barcode` con el código (`^[0-9]{6,14}$`, único entre públicos).
  Antes de exportar o publicar el catálogo completo, revisar el alcance de la ODbL.
- OFF es colaborativa y puede tener errores: entra como `unverified` y solo pasa a `verified` tras
  compararla con la etiqueta física del producto.

### 4.3 Tablas Peruanas de Composición de Alimentos (TPCA, CENAN/INS)

- Referencia: Instituto Nacional de Salud, Centro Nacional de Alimentación y Nutrición. *Tablas peruanas
  de composición de alimentos*, 10.ª ed. Lima: INS; 2017. Se consigue en el portal y repositorio del INS.
- Es la fuente preferida para alimentos andinos y amazónicos, variedades locales y preparaciones
  peruanas (todo lo marcado como estimación propia o análogo USDA).
- Valores por 100 g de parte comestible; anota el **código** del alimento en la tabla. La TPCA puede
  calcular la energía con factores generales y no siempre trae azúcares o grasa saturada: copia la energía
  tal como figura y deja en `null` lo que no esté.
- Al verificar: `source_ref` = `TPCA 2017 (CENAN/INS), código X, "nombre en la tabla"`;
  `license` = `Uso con cita de la fuente (CENAN/INS)` (confirmar las condiciones en la publicación).

## 5. Flujo de revisión en `/admin`

Estados de `verification_status`:

| Estado | Significa |
|---|---|
| `unverified` | Carga inicial aproximada (todo este seed). |
| `curated` | El staff lo revisó y ajustó con una fuente secundaria o una estimación documentada (p. ej. un plato recalculado), sin un ID de fuente primaria. |
| `verified` | Coincide con una fuente primaria citada con su identificador (FDC ID, código TPCA, etiqueta física). |
| `rejected` | Dato erróneo; no debe ofrecerse en búsquedas ni usarse en recetas nuevas. |

Pasos (rol editor o superior; el panel debe registrar cada cambio con `log_admin_action`):

1. **Priorizar**: filtra alimentos `unverified` y empieza por los que usan las recetas oficiales y los
   más registrados por los usuarios; después las estimaciones propias y los análogos (apéndice B).
2. **Comparar** con la fuente (sección 4), corregir valores y completar `source_ref` con ID y fecha,
   `source_url` y `license`.
3. **Marcar** `curated` o `verified` (el panel guarda `verified_by` y `verified_at`). Si el dato está mal y
   no se puede corregir, `rejected`.
4. **Platos**: cuando sus ingredientes estén verificados, recalcular con la receta estándar (apéndice A) o
   reemplazar por la preparación equivalente de la TPCA. Quedan como `curated` salvo que vengan de una tabla.
5. **Porciones**: pesar las medidas caseras más usadas y corregir `gram_weight`.
6. **Recetas**: la vista `recipe_nutrition` se recalcula sola al corregir alimentos. Revisar de nuevo
   `diet_tags` y `allergens` con las reglas de la sección 6 y el costo con precios actualizados. Las 36
   recetas se publicaron sin `reviewed_by`: conviene que una nutricionista las revise y que el panel guarde
   `reviewed_by`/`reviewed_at`.
7. **Precios**: reemplazar los referenciales por observaciones reales (mercado y fecha, o reportes públicos
   de precios como los del Ministerio de Desarrollo Agrario y Riego), con `source` descriptivo y la fecha
   real en `observed_on`.

## 6. Reglas usadas en el seed

**Coherencia de macros** (`scripts/check-seed.mjs`): 4·P + 4·C + 9·G debe quedar dentro de ±15 % de
`energy_kcal`, o dentro de ±15 % contando la fibra a 2 kcal/g, o a ±5 kcal en alimentos de muy baja
energía. Las fuentes usan factores de Atwater específicos por alimento (frutas y verduras dan +10–13 % con
4/4/9, por eso la tolerancia). Excepciones explicadas:

- **Cerveza**: el alcohol aporta ~7 kcal/g y no figura en proteína, carbohidratos ni grasa.
- **Jugo de limón**: los ácidos orgánicos cuentan como carbohidrato pero aportan menos energía (~2,5 kcal/g).
- **Vinagre**: la energía viene del ácido acético, que no figura en los macros.

**Etiquetas de dieta de las recetas** (calculadas desde los ingredientes, por porción):

| Etiqueta | Regla |
|---|---|
| `vegetarian` | sin carne, aves, pescado ni mariscos |
| `vegan` | además, sin huevo, lácteos ni miel |
| `high_protein` | ≥ 20 g de proteína y ≥ 25 % de la energía desde proteína |
| `low_carb` | ≤ 20 g de carbohidratos |
| `budget` | costo referencial ≤ S/ 5.00 por porción |
| `quick` | preparación + cocción ≤ 20 min (sin reposos largos) |

**Alérgenos**: `gluten` (pan, fideos, harina de trigo, galletas, sillao y **avena**, que se marca por
contaminación cruzada frecuente), `lactosa` (leche, yogurt, quesos, mantequilla, manjar), `huevo` (incluye
mayonesa), `pescado`, `mariscos`, `mani`, `frutos_secos` (almendras, nueces), `soya` (tofu, sillao),
`sesamo` (ninguna receta lo usa).

**`estimated_cost`** = costo **total** de la receta (todas las porciones) en PEN, redondeado a S/ 0.10:
gramos usados ÷ fracción comestible de lo comprado × precio referencial. Los alimentos cocidos se
convierten a su equivalente de compra (arroz cocido ×0,37 de arroz crudo; menestras cocidas ×0,40–0,42
de secas; pechuga a la plancha ×1,33 de cruda; clara ×1,72 de huevo entero). Como los precios no tienen
fuente verificada, el costo es solo una orientación.

**Precios** (`30_reference_prices.sql`): `source` = "Referencial inicial sin fuente verificada — actualizar en
/admin" y `observed_on` = 2026-10-01, que es la fecha de carga de la referencia y no una observación de
mercado. `item_name` describe la forma de compra (entero, con hueso, lata, bolsa); `per_unit = 'unit'` es
una unidad de lo descrito.

## Apéndice A — Receta estándar de cada plato

Ingredientes en crudo o como figuran en el seed ("Agua" no aporta nutrientes) y peso final del plato
listo. Los valores resultantes son por 100 g (P = proteína, C = carbohidratos, G = grasa, en gramos).

| Plato | Composición | Peso final | Resultado por 100 g |
|---|---|---|---|
| Arroz blanco graneado | Arroz blanco crudo: 370 g; Aceite vegetal: 20 g; Ajo: 8 g; Sal de mesa: 7 g; Agua: 700 g | 1050 g | 147 kcal · P 2.6 · C 28.4 · G 2.1 |
| Ceviche de pescado | Perico (dorado), crudo: 500 g; Limón, jugo: 150 g; Cebolla roja: 200 g; Rocoto: 15 g; Culantro: 5 g; Kion (jengibre): 3 g; Sal de mesa: 8 g | 881 g | 63 kcal · P 10.9 · C 3.8 · G 0.4 |
| Lomo saltado | Lomo fino de res, crudo: 300 g; Cebolla roja: 200 g; Tomate: 200 g; Ají amarillo: 30 g; Sillao (salsa de soya): 20 g; Vinagre: 15 g; Aceite vegetal: 20 g; Ajo: 6 g; Culantro: 5 g; Sal de mesa: 4 g; Papas fritas: 250 g | 925 g | 166 kcal · P 8.5 · C 14.7 · G 8.3 |
| Pollo a la brasa con piel | Pollo con piel, asado: 1000 g; Sillao (salsa de soya): 15 g; Sal de mesa: 6 g | 1021 g | 235 kcal · P 26.9 · C 0.1 · G 13.3 |
| Ají de gallina | Pechuga de pollo sin piel, a la plancha: 500 g; Pan de molde blanco: 100 g; Leche evaporada entera: 200 g; Ají amarillo: 100 g; Cebolla roja: 200 g; Ajo: 10 g; Nueces: 30 g; Queso andino: 50 g; Aceite vegetal: 40 g; Sal de mesa: 6 g; Agua: 300 g | 1300 g | 171 kcal · P 15.2 · C 8.2 · G 8.5 |
| Causa limeña de pollo | Papa amarilla sancochada: 1000 g; Aceite vegetal: 60 g; Limón, jugo: 40 g; Ají amarillo: 60 g; Sal de mesa: 8 g; Pechuga de pollo sin piel, a la plancha: 300 g; Mayonesa: 80 g; Palta: 200 g; Cebolla roja: 50 g; Huevo sancochado: 100 g; Aceituna de botija: 30 g | 1928 g | 163 kcal · P 7 · C 13.7 · G 9.1 |
| Arroz con pollo | Arroz blanco crudo: 400 g; Pollo con piel, asado: 600 g; Culantro: 80 g; Espinaca: 60 g; Arvejas verdes cocidas: 150 g; Zanahoria: 100 g; Pimiento rojo: 80 g; Choclo cocido: 100 g; Cebolla roja: 150 g; Ajo: 10 g; Ají amarillo: 40 g; Aceite vegetal: 40 g; Sal de mesa: 10 g; Agua: 900 g | 2450 g | 149 kcal · P 8.7 · C 16.5 · G 5.2 |
| Seco de res | Carne de res magra, cruda: 700 g; Culantro: 80 g; Cebolla roja: 200 g; Ajo: 10 g; Ají amarillo: 50 g; Arvejas verdes cocidas: 150 g; Zanahoria: 150 g; Papa blanca cruda: 300 g; Aceite vegetal: 40 g; Sal de mesa: 10 g; Agua: 400 g | 1650 g | 108 kcal · P 10.6 · C 7.2 · G 4.2 |
| Tacu tacu | Arroz blanco cocido: 500 g; Frejol canario cocido: 500 g; Cebolla roja: 100 g; Ajo: 8 g; Ají amarillo: 30 g; Aceite vegetal: 50 g; Sal de mesa: 6 g | 1134 g | 165 kcal · P 5.4 · C 24.9 · G 5 |
| Anticuchos de corazón | Corazón de res, crudo: 1000 g; Ají panca seco: 30 g; Vinagre: 30 g; Ajo: 20 g; Aceite vegetal: 40 g; Sal de mesa: 10 g | 760 g | 210 kcal · P 24 · C 3.1 · G 10.8 |
| Papa a la huancaína | Papa blanca sancochada: 800 g; Queso fresco: 200 g; Leche evaporada entera: 150 g; Ají amarillo: 80 g; Aceite vegetal: 60 g; Galletas de soda: 30 g; Sal de mesa: 3 g; Huevo sancochado: 100 g; Aceituna de botija: 30 g; Lechuga: 40 g | 1493 g | 159 kcal · P 5.2 · C 14.4 · G 9.1 |
| Rocoto relleno | Rocoto: 600 g; Carne molida de res 80 % magra, cruda: 300 g; Cebolla roja: 200 g; Ají panca seco: 15 g; Maní tostado sin sal: 30 g; Pasas: 20 g; Huevo sancochado: 100 g; Queso fresco: 150 g; Leche evaporada entera: 100 g; Aceite vegetal: 30 g; Sal de mesa: 5 g; Azúcar blanca: 10 g | 1400 g | 171 kcal · P 8.7 · C 9.4 · G 11.5 |
| Carapulcra | Papa seca: 300 g; Pierna de cerdo, cruda: 500 g; Ají panca seco: 30 g; Cebolla roja: 200 g; Ajo: 15 g; Maní tostado sin sal: 50 g; Aceite vegetal: 50 g; Sal de mesa: 8 g; Agua: 1500 g | 2120 g | 151 kcal · P 6.2 · C 13.8 · G 8.2 |
| Juane de gallina | Arroz blanco crudo: 500 g; Pollo con piel, asado: 600 g; Huevo sancochado: 200 g; Aceituna de botija: 40 g; Cebolla roja: 150 g; Ajo: 10 g; Aceite vegetal: 50 g; Sal de mesa: 10 g; Agua: 1000 g | 2300 g | 180 kcal · P 9.9 · C 18.3 · G 7 |
| Tamal criollo | Harina de maíz amarillo: 500 g; Aceite vegetal: 120 g; Pierna de cerdo, cruda: 250 g; Ají amarillo: 40 g; Ajo: 10 g; Sal de mesa: 10 g; Agua: 900 g; Huevo sancochado: 100 g; Aceituna de botija: 30 g; Maní tostado sin sal: 20 g | 1895 g | 202 kcal · P 5.4 · C 21 · G 11 |
| Humita dulce | Choclo cocido: 1000 g; Mantequilla con sal: 80 g; Azúcar blanca: 100 g; Leche evaporada entera: 100 g; Pasas: 30 g; Sal de mesa: 2 g | 1246 g | 172 kcal · P 3.4 · C 27.6 · G 7 |
| Arroz chaufa de pollo | Arroz blanco cocido: 1000 g; Pechuga de pollo sin piel, a la plancha: 250 g; Huevo de gallina: 150 g; Cebolla china: 80 g; Sillao (salsa de soya): 50 g; Kion (jengibre): 10 g; Ajo: 6 g; Aceite vegetal: 50 g; Sal de mesa: 2 g | 1550 g | 157 kcal · P 8.3 · C 19 · G 4.9 |
| Tallarines verdes | Fideos cocidos: 1000 g; Albahaca: 60 g; Espinaca: 150 g; Queso fresco: 100 g; Leche evaporada entera: 150 g; Cebolla roja: 80 g; Ajo: 8 g; Aceite vegetal: 50 g; Nueces: 20 g; Sal de mesa: 5 g | 1623 g | 169 kcal · P 6 · C 21.4 · G 6.7 |
| Sudado de pescado | Jurel, crudo: 600 g; Cebolla roja: 250 g; Tomate: 300 g; Ají amarillo: 40 g; Ajo: 8 g; Culantro: 10 g; Aceite vegetal: 20 g; Sal de mesa: 7 g; Agua: 200 g | 1290 g | 101 kcal · P 9.9 · C 3.2 · G 5.3 |
| Chupe de camarones | Langostinos, crudos: 400 g; Papa amarilla sancochada: 400 g; Arroz blanco crudo: 60 g; Choclo cocido: 200 g; Arvejas verdes cocidas: 100 g; Cebolla roja: 150 g; Ajo: 8 g; Ají panca seco: 10 g; Leche evaporada entera: 200 g; Queso fresco: 100 g; Huevo de gallina: 150 g; Aceite vegetal: 30 g; Sal de mesa: 10 g; Agua: 1500 g | 2990 g | 80 kcal · P 5.3 · C 8.1 · G 3 |
| Parihuela | Merluza, cruda: 400 g; Pota, cruda: 200 g; Choros (mejillones), crudos: 200 g; Langostinos, crudos: 150 g; Cebolla roja: 200 g; Tomate: 300 g; Ají panca seco: 15 g; Ají amarillo: 30 g; Ajo: 10 g; Aceite vegetal: 30 g; Sal de mesa: 10 g; Agua: 1500 g | 2740 g | 48 kcal · P 6.1 · C 2.1 · G 1.7 |
| Caldo de gallina | Pollo con piel, asado: 600 g; Fideos secos: 150 g; Papa amarilla sancochada: 400 g; Huevo sancochado: 100 g; Cebolla china: 40 g; Kion (jengibre): 15 g; Sal de mesa: 12 g; Agua: 2500 g | 3435 g | 75 kcal · P 6 · C 6.1 · G 2.8 |
| Menestrón | Carne de res magra, cruda: 300 g; Frejol canario cocido: 200 g; Choclo cocido: 200 g; Zapallo macre: 200 g; Papa blanca cruda: 300 g; Yuca cruda: 200 g; Fideos secos: 100 g; Repollo: 150 g; Vainita: 100 g; Zanahoria: 100 g; Albahaca: 40 g; Espinaca: 60 g; Queso fresco: 80 g; Aceite vegetal: 30 g; Sal de mesa: 12 g; Agua: 2500 g | 4290 g | 57 kcal · P 3.2 · C 7.9 · G 1.6 |
| Adobo de cerdo | Pierna de cerdo, cruda: 1000 g; Ají panca seco: 30 g; Vinagre: 60 g; Cebolla roja: 200 g; Ajo: 20 g; Aceite vegetal: 20 g; Sal de mesa: 10 g; Agua: 300 g | 1230 g | 230 kcal · P 14.7 · C 3.3 · G 17.2 |
| Olluquito con carne | Olluco: 800 g; Carne de res magra, cruda: 300 g; Cebolla roja: 150 g; Ají panca seco: 15 g; Ají amarillo: 30 g; Ajo: 8 g; Aceite vegetal: 30 g; Sal de mesa: 8 g; Culantro: 10 g; Agua: 200 g | 1318 g | 94 kcal · P 6 · C 10.2 · G 3.4 |
| Estofado de pollo | Pierna de pollo sin piel, cruda: 700 g; Papa blanca cruda: 500 g; Zanahoria: 200 g; Arvejas verdes cocidas: 150 g; Tomate: 300 g; Cebolla roja: 200 g; Ajo: 10 g; Ají panca seco: 10 g; Aceite vegetal: 30 g; Sal de mesa: 8 g; Agua: 300 g | 2047 g | 92 kcal · P 7.9 · C 8.2 · G 2.9 |
| Salchipapa | Papas fritas: 300 g; Salchicha de hot dog: 120 g; Aceite vegetal: 5 g; Sal de mesa: 1 g | 426 g | 293 kcal · P 6.8 · C 30 · G 16.1 |
| Pan con chicharrón | Pan francés: 60 g; Pierna de cerdo, cruda: 150 g; Camote sancochado: 60 g; Aceite vegetal: 8 g; Cebolla roja: 30 g; Limón, jugo: 5 g; Ají amarillo: 3 g; Sal de mesa: 1 g | 257 g | 262 kcal · P 13 · C 17.8 · G 15.2 |
| Butifarra | Pan francés: 60 g; Pierna de cerdo, cruda: 120 g; Cebolla roja: 30 g; Limón, jugo: 5 g; Ají amarillo: 3 g; Lechuga: 10 g; Sal de mesa: 1 g | 189 g | 257 kcal · P 14.5 · C 18.7 · G 13.4 |
| Picarones con miel | Harina de trigo: 500 g; Camote sancochado: 250 g; Zapallo macre: 250 g; Azúcar blanca: 30 g; Agua: 150 g; Aceite vegetal: 250 g; Azúcar rubia: 400 g; Agua: 200 g | 1700 g | 348 kcal · P 3.4 · C 50.9 · G 15 |
| Suspiro limeño | Leche condensada: 400 g; Leche evaporada entera: 400 g; Huevo de gallina: 60 g; Clara de huevo: 100 g; Azúcar blanca: 150 g; Agua: 50 g | 930 g | 273 kcal · P 8.3 · C 44 · G 7.6 |
| Mazamorra morada | Piña: 200 g; Manzana: 200 g; Azúcar blanca: 250 g; Maicena (almidón de maíz): 120 g; Limón, jugo: 30 g; Agua: 1500 g | 1700 g | 96 kcal · P 0.1 · C 24.5 · G 0 |
| Arroz con leche | Arroz blanco crudo: 200 g; Leche evaporada entera: 400 g; Leche condensada: 200 g; Azúcar blanca: 30 g; Pasas: 30 g; Agua: 1000 g | 1500 g | 141 kcal · P 3.9 · C 24.2 · G 3.3 |
| Alfajor de manjar blanco | Harina de trigo: 200 g; Maicena (almidón de maíz): 150 g; Mantequilla con sal: 200 g; Azúcar blanca: 80 g; Manjar blanco: 400 g | 990 g | 435 kcal · P 5.1 · C 59.7 · G 19.6 |
| Leche de tigre | Limón, jugo: 200 g; Perico (dorado), crudo: 100 g; Cebolla roja: 80 g; Rocoto: 20 g; Culantro: 5 g; Kion (jengibre): 5 g; Sal de mesa: 6 g; Agua: 200 g | 616 g | 29 kcal · P 3.4 · C 4.4 · G 0.2 |
| Chicha morada | Azúcar blanca: 220 g; Limón, jugo: 60 g; Piña: 100 g; Agua: 1800 g | 2000 g | 46 kcal · P 0 · C 11.9 · G 0 |
| Emoliente | Linaza: 20 g; Azúcar rubia: 150 g; Limón, jugo: 40 g; Agua: 2000 g | 2000 g | 34 kcal · P 0.2 · C 7.8 · G 0.4 |

## Apéndice B — Alimentos aproximados (revisar primero)

### Estimaciones propias

| Alimento | Tabla usada | Motivo |
|---|---|---|
| Cancha tostada | — | maíz cancha tostado con poco aceite; base USDA "Corn grain, yellow" con menos agua y aceite añadido; la sal varía |
| Papa amarilla sancochada | — | papa amarilla (Solanum goniocalyx), con más materia seca que la papa blanca |
| Papa huayro sancochada | — | papa nativa harinosa, valor intermedio entre papa blanca y amarilla |
| Olluco | — | tubérculo andino Ullucus tuberosus, crudo |
| Oca | — | tubérculo andino Oxalis tuberosa, crudo |
| Chuño seco | — | papa deshidratada por congelamiento; casi todo es almidón |
| Bonito, crudo | — | Sarda chiliensis, filete crudo; valor intermedio entre atunes y caballas |
| Lúcuma | — | pulpa fresca de Pouteria lucuma |
| Camu camu, pulpa | — | pulpa de Myrciaria dubia, muy ácida y baja en azúcar |
| Sacha inchi tostado | — | semillas tostadas de Plukenetia volubilis; rangos publicados de proteína y grasa |

### Análogos de USDA

| Alimento | Entrada USDA usada | Motivo |
|---|---|---|
| Pan francés | "Rolls, hard (includes kaiser)" | pan de corteza dura similar al pan francés peruano |
| Choclo cocido | "Corn, sweet, yellow, cooked, boiled, drained, without salt" | el choclo andino tiene más almidón y menos azúcar que el maíz dulce |
| Papa seca | "Potatoes, mashed, dehydrated, flakes without milk, dry form" | papa cocida y deshidratada; composición análoga a hojuelas de papa deshidratada |
| Frejol canario cocido | "Beans, yellow, mature seeds, cooked, boiled, without salt" | el frejol canario es un frejol amarillo |
| Frejol canario seco | "Beans, yellow, mature seeds, raw" | el frejol canario es un frejol amarillo |
| Pierna de pollo sin piel, cruda | "Chicken, broilers or fryers, leg, meat only, raw" | valor redondeado (encuentro + muslo, solo carne) |
| Pierna de pollo sin piel, cocida | "Chicken, broilers or fryers, leg, meat only, cooked, roasted" | valor redondeado (encuentro + muslo, solo carne) |
| Carne de res magra, cruda | "Beef, round, top round, separable lean only, raw" | valor redondeado para cortes magros (tapa, cadera, pierna) |
| Carne de res magra, a la plancha | "Beef, round, top round, separable lean only, cooked, broiled" | valor redondeado para cortes magros |
| Lomo fino de res, crudo | "Beef, tenderloin, steak, separable lean only, trimmed to 0" fat, raw" | valor redondeado |
| Pechuga de pavo, cruda | "Turkey breast, meat only, raw" | valor redondeado para pechuga de pavo sin piel |
| Salchicha de hot dog | "Frankfurter, chicken" | salchicha tipo hot dog de pollo; varía mucho por marca |
| Jurel, crudo | "Fish, mackerel, Pacific and jack, mixed species, raw" | Trachurus murphyi |
| Caballa, cruda | "Fish, mackerel, Pacific and jack, mixed species, raw" | Scomber japonicus |
| Merluza, cruda | "Fish, whiting, mixed species, raw" | pescado blanco magro análogo a la merluza peruana |
| Pota, cruda | "Mollusks, squid, mixed species, raw" | calamar gigante Dosidicus gigas |
| Conchas negras, crudas | "Mollusks, clam, mixed species, raw" | Anadara tuberculosa |
| Conchas de abanico, crudas | "Mollusks, scallop, mixed species, raw" | Argopecten purpuratus |
| Queso andino | "Cheese, gouda" | queso semimaduro análogo al queso andino o paria |
| Manjar blanco | "Dulce de leche" | manjar blanco peruano análogo al dulce de leche |
| Plátano de isla | "Bananas, raw" | variedad pequeña peruana; se usó el valor general del plátano |
| Granadilla | "Passion-fruit, (granadilla), purple, raw" | Passiflora ligularis; se usó el maracuyá morado como análogo |
| Aceituna de botija | "Olives, ripe, canned (small-extra large)" | aceituna negra en salmuera; la botija suele ser más salada, por eso el sodio queda sin valor |
| Cebolla roja | "Onions, raw" | cebolla roja peruana |
| Zapallo macre | "Pumpkin, raw" | zapallo macre o loche |
| Ají amarillo | "Peppers, hot chili, red, raw" | ají amarillo fresco (Capsicum baccatum) |
| Rocoto | "Peppers, hot chili, green, raw" | rocoto (Capsicum pubescens) |
| Ají panca seco | "Peppers, ancho, dried" | ají seco análogo; el ají panca es Capsicum chinense |
| Aceite vegetal | "Oil, soybean, salad or cooking" | aceite vegetal comercial (soya, girasol o mezcla) |
| Mantequilla de maní | "Peanut butter, smooth style, without salt" | mantequilla de maní natural, sin azúcar añadida |
| Gaseosa regular | "Beverages, carbonated, cola, contains caffeine" | gaseosa con azúcar; varía por marca y sabor |

### TACO

| Alimento | Entrada TACO | — |
|---|---|---|
| Yuca sancochada | "Mandioca, cozida" | — |
