# Módulo alimentos — base de alimentos y código de barras

Dueño de `/api/foods/*`, `/app/agregar/codigo`, `src/lib/foods/*` (salvo `types.ts` y `search.ts`, que
son compartidos y no se tocaron) y `src/features/foods/`.

## Qué quedó funcional

### API (route handlers, sesión obligatoria → 401 JSON)
| Ruta | Respuesta | Límite por usuario |
|---|---|---|
| `GET /api/foods/search?q=&limit=` (contrato 1) | `200 { foods: FoodWithPortions[] }` — `FoodSummary` + `portions` (`food_portions`, la por defecto primero). `q` 1–80 caracteres (con 1 letra devuelve `[]` sin consultar), `limit` 1–50 (def. 20). 400 si no valida. | 60/min (`foods_search`) |
| `GET /api/foods/{id}` (contrato 2) | `200 { food: FoodDetail }` — lo pactado (`portions`, `micronutrients` de `food_nutrients` + `nutrient_definitions`) **más** `description`, `sourceUrl` y `license` (la atribución ODbL debe verse). 404 si no existe, no es visible por RLS o el id está mal formado. | 120/min (`foods_detail`) |
| `GET /api/foods/barcode/{code}` | `200 { food: FoodDetail, origin: 'database' \| 'open_food_facts', barcode: { code, format } }` · 400 `INVALID_BARCODE` · 404 `NOT_FOUND` / `REJECTED` · 422 `INCOMPLETE_DATA` (+ `product: { name, brandName }` para precargar) · 429 · 502 `UPSTREAM_ERROR` / `UPSTREAM_TIMEOUT` / `UPSTREAM_RATE_LIMITED` · 503 `NOT_CONFIGURED` (falta service role) / `UPSTREAM_BUSY` | 30/min (`foods_barcode`) + 90/min global hacia OFF (`off_api:global`, con service role) |

Errores siempre como `{ error: { code, message } }`, `Cache-Control: private, no-store`. Tipos de
respuesta en `src/lib/foods/api-types.ts` (importables desde cliente).

### Código de barras
- `src/lib/foods/barcode.ts`: EAN-13, EAN-8, UPC-A y UPC-E con dígito verificador (UPC-E se expande a
  UPC-A). Cada código genera sus variantes equivalentes (`lookupCodes`: UPC-A ↔ EAN-13 con 0 inicial) y
  el código para consultar OFF (`offCode`). Acepta espacios/guiones y GTIN-14 con 0 inicial.
- Flujo del servidor (`src/features/foods/server/barcode-lookup.ts`): base local (todas las variantes,
  públicos primero, sin rechazados) → Open Food Facts v2 (`fields=code,product_name,product_name_es,
  brands,nutriments,serving_size,quantity`, `User-Agent: OrangeFit/0.1 (<support_email de app_settings>)`,
  timeout 6 s) → mapeo por 100 g → guardado como alimento **público** con el cliente admin: `source
  'open_food_facts'`, `verification_status 'unverified'`, `license 'ODbL — © colaboradores de Open Food
  Facts'`, `source_url` del producto, `source_ref 'off:{código}'`, marca normalizada y reutilizada por
  `brands.name_normalized`, porciones de la etiqueta en gramos (porción declarada y envase).
- Mapeo OFF (`src/lib/foods/open-food-facts.ts`): `energy-kcal_100g`; si solo hay kJ, ÷ 4.184 y se anota
  en la descripción; proteína, carbohidratos y grasa obligatorios; fibra, azúcares, grasa saturada
  opcionales (null si faltan); `sodium_100g` g → mg (si solo hay sal: sal ÷ 2.5, anotado). Se rechazan
  valores fuera de los checks de `foods`, macros que suman > 100 g y energía muy por debajo de la de los
  macros (mezcla porción/100 g). Azúcar > carbohidratos o saturada > grasa se descartan (null + nota).
  Nada se completa por cuenta propia.
- Página `/app/agregar/codigo`: explica el uso de la cámara antes de pedir permiso (si ya está concedido
  abre directo), `BarcodeDetector` nativo si soporta EAN/UPC y si no ZXing (`BrowserMultiFormatReader`,
  carga diferida), linterna si la pista la soporta, entrada manual con validación del verificador,
  resultado con nutrientes por 100 g, micronutrientes, procedencia y atribución con enlace a la fuente,
  selector de porción/gramos y comida (4 estándar + personalizadas del día), vista previa calculada con
  el motor y registro con `logBarcodeFoodAction` → `addItemsToMeal` (`source 'barcode'`). Estados: sin
  permiso, sin cámara, cámara ocupada, navegador sin soporte, buscando (skeleton), no encontrado /
  rechazado / incompleto (ofrece crear el alimento propio en `/app/alimentos/nuevo?codigo=&nombre=&volver=`;
  al volver con `?codigo=` se busca solo), 401, 429, 502, 503 con reintento. Respeta `?fecha=&comida=&nombre=`
  de `/app/agregar` y guarda `?codigo=` en la URL.

### USDA FoodData Central (contrato 3)
- `src/lib/foods/usda.ts` → `importUsdaFoods(admin, { query?, fdcIds?, limit? })` (server-only, lee
  `FDC_API_KEY` de `serverEnv()`). Sin clave lanza `UsdaError` con `code 'USDA_NOT_CONFIGURED'`.
  Devuelve `{ inserted, updated, skipped, errors }` y además `skippedReasons` (motivo de cada omitido).
- Núcleo en `src/lib/foods/usda-core.ts` (sin `server-only`, para el CLI): `GET /v1/foods/search`
  (Foundation + SR Legacy) y `GET /v1/foods?fdcIds=` en lotes de 20. Mapea por id de nutriente (1008,
  1003, 1005, 1004, 1079, 2000, 1258, 1093; respaldo por número antiguo y por 2047/2048, 1050, 1085,
  1063; kJ 1062 ÷ 4.184) y los micronutrientes definidos en `nutrient_definitions` con conversión g/mg/µg
  (lo que viene en IU no se convierte). Porciones de FDC con unidades traducidas ("1 cup" → "1 taza").
- Upsert por `source_ref 'fdc:{fdcId}'`: alta como pública `source 'usda'`, `verified`, `license
  'Dominio público (USDA)'`, `source_url` de FDC. En la actualización solo se reescriben nutrientes y
  procedencia (no nombre, marca ni descripción, que el staff puede haber traducido); un `rejected` sigue
  rechazado; las porciones solo se crean si el alimento no tiene; los micronutrientes se hacen upsert.
  El nombre queda en inglés (como en FDC) y la descripción lo indica.
- CLI: `npx tsx scripts/import-usda.ts --query "quinoa" --limit 20`, `--fdc-ids 168917,168874`,
  `--dry-run` (solo muestra el mapeo). Lee `.env.local`.

### Duplicados (contrato 4) y utilidades
- `src/lib/foods/dedup.ts`: `findDuplicateCandidates(supabase, { limit?, threshold? })` sobre públicos no
  rechazados (paginado de a 1000). Puntaje = 0.6 × similitud de trigramas (como pg_trgm) del nombre
  normalizado + 0.4 × cercanía de macros; misma marca +0.05, marcas distintas −0.3, códigos distintos
  −0.3. Umbral por defecto 0.8, límite 50. Exporta `normalizeText`, `normalizeFoodName`, `trigrams`,
  `trigramSimilarity`, `scoreDuplicate`, `findDuplicatePairs` (puros).
- `src/lib/foods/units-portions.ts`: `gramsFor` (cantidad + unidad → g con porciones y densidad, vía
  `src/lib/nutrition/units.ts`), opciones de cantidad para selectores y `parseGramsFromLabel` ("2
  cucharadas (30 g)" → 30; ml sin densidad → null).
- `src/lib/foods/details.ts` (server-only): `getPortionsByFoodIds`, `withPortions`, `getMicronutrients`,
  `getFoodDetail`, `findFoodByBarcodes`. `src/lib/foods/off-import.ts`: `saveOffFood`.

## Qué requiere credenciales o servicios
- **Open Food Facts**: no necesita clave, pero sí salida a internet. Desde este contenedor no hay DNS
  hacia OFF: la ruta responde 502 real (probado). Para guardar lo que trae OFF hace falta
  `SUPABASE_SERVICE_ROLE_KEY`; sin ella responde 503 explicando que no se puede guardar.
- **Correo de soporte**: el User-Agent usa `app_settings.support_email` (hoy `soporte@example.com`,
  marcador). Cambiarlo antes de producción; si falta se usa la URL del sitio.
- **USDA**: `FDC_API_KEY` (gratis en api.data.gov). Sin ella, `importUsdaFoods` y el CLI fallan con
  `USDA_NOT_CONFIGURED`. No se probó contra la API real (sin clave ni red en este entorno); el mapeo se
  probó con respuestas grabadas con la forma real de FDC.

## Qué falta / decisiones a revisar
- El panel admin (dueño: admin) debe llamar a `importUsdaFoods` y `findDuplicateCandidates`; este módulo
  no tiene UI de administración.
- La búsqueda por código no usa `getFoodByBarcode` de `search.ts`: hace una sola consulta con todas las
  variantes del código (UPC-A/EAN-13/UPC-E) y descarta rechazados. `getFoodByBarcode` sigue igual para
  quien lo use.
- Los micronutrientes de OFF no se importan (OFF mezcla unidades por nutriente; preferimos no arriesgar
  errores de ×1000).
- Productos OFF con energía solo por porción, sin nombre o incoherentes no se guardan: la UI ofrece crear
  el alimento propio con nombre y marca precargados (422).
- El límite global hacia OFF solo aplica si hay service role (sin él tampoco se guarda nada).
- `rate_limits` conserva las claves de usuarios de prueba borrados (no hay acceso por API para limpiar).

## Pruebas
- Unitarias: `src/lib/foods/*.test.ts` (códigos, mapeo OFF/USDA con fixtures JSON en
  `src/lib/foods/__fixtures__`, kJ → kcal, dedup, porciones) y `src/features/foods/**/*.test.ts(x)`
  (orquestación del lookup con OFF simulado, cliente de la API, cámara, comidas, flujo de UI en jsdom).
- Integración: `tests/integration/alimentos-api.test.ts` (route handlers reales con sesión en cookies,
  401, 400, 404, 429, código encontrado en la base local y variante UPC-A, 502 real sin red, guardado
  OFF/USDA en la base, duplicados y la acción de registro).
