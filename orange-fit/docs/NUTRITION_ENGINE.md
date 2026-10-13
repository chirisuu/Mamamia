# Motor nutricional — ORANGE FIT

`src/lib/nutrition/` es un motor **puro**: sin I/O, sin Supabase, sin React y sin IA. Todo entra por
parámetros y sale como datos; cada módulo tiene su `*.test.ts` al lado. Los textos para el usuario
están en español (Perú, tuteo); los identificadores, en inglés. `index.ts` reexporta todo.

Los errores de entrada lanzan `NutritionInputError` (`code`, `field`, mensaje en español listo para
mostrar). `units.ts` usa la subclase `UnitConversionError`.

| Módulo | Qué hace |
|---|---|
| `bmi.ts` | IMC, categoría OMS, rango de peso normal para la talla |
| `bmr.ts` | Metabolismo basal (Mifflin-St Jeor) con validación de rangos |
| `activity.ts` | Factores de actividad y sugerencia de nivel |
| `risk.ts` | Cribado de riesgo: nivel, bloqueos y mensajes prudentes |
| `targets.ts` | Metas diarias (kcal, macros, fibra, agua) con pasos y supuestos |
| `water.ts` | Meta de agua (EFSA) y progreso |
| `units.ts` | Unidades de masa/volumen y conversión a gramos |
| `portions.ts` | Nutrientes de una porción (por 100 g → gramos) y sumas |
| `recipes.ts` | Nutrición de recetas desde ingredientes; escalado de porciones |
| `energy-balance.ts` | Presupuesto del día (base + ejercicio opcional + ajustes) |
| `exercise.ts` | Catálogo de actividades con MET y kcal brutas/netas |
| `weight-trend.ts` | Promedio móvil, regresión, ritmo, proyección, comparación |
| `adherence.ts` | Estado del día, rachas y adherencia semanal |
| `fasting.ts` | Protocolos, estado, estadísticas y permiso para ayunar |
| `planner.ts` | Planificador de comidas determinista con diagnósticos |
| `shopping.ts` | Lista de compras consolidada con costo referencial |
| `gamification.ts` | Insignias y retos sin castigos |

---

## 1. IMC (`bmi.ts`)

`IMC = peso (kg) / talla (m)²`. Rangos aceptados: peso 20–400 kg, talla 100–250 cm (los mismos
checks de la base).

Clasificación de la OMS para adultos (WHO TRS 894, 2000), comparando el IMC **redondeado a 1
decimal** (así 24.96 → 25.0 → sobrepeso, igual que se muestra):

| IMC | Categoría |
|---|---|
| < 18.5 | Bajo peso |
| 18.5–24.9 | Peso normal |
| 25.0–29.9 | Sobrepeso |
| 30.0–34.9 | Obesidad grado I |
| 35.0–39.9 | Obesidad grado II |
| ≥ 40.0 | Obesidad grado III |

`bmiReport` agrega el rango de peso con IMC 18.5–24.9 para la talla y notas: el IMC no distingue
músculo de grasa; en menores de 18 se usan tablas por edad y sexo (OMS), no estos cortes.

## 2. Metabolismo basal (`bmr.ts`)

Mifflin-St Jeor (Mifflin et al., 1990):

```
TMB = 10 × peso(kg) + 6.25 × talla(cm) − 5 × edad(años) + s     s = +5 hombre, −161 mujer
```

- Validación: edad 13–100 años, peso 20–400 kg, talla 100–250 cm, sexo `male|female`.
- La ecuación se derivó en adultos de 19 a 78 años: `bmrWarnings` avisa si la edad es < 18
  («solo referencial») o > 78 («menos preciso»). En una persona concreta la estimación puede
  desviarse en torno a ±10 % (o más) de la medición real.

## 3. Actividad (`activity.ts`)

| Nivel | Factor | Descripción (resumen) |
|---|---|---|
| sedentary | 1.2 | Mayormente sentado, casi sin ejercicio planificado |
| light | 1.375 | Ejercicio ligero 1–3 días/semana o camina bastante |
| moderate | 1.55 | Ejercicio moderado 3–5 días/semana |
| active | 1.725 | Intenso 6–7 días/semana |
| very_active | 1.9 | Fuerte a diario (o doble turno) o trabajo físico pesado además de entrenar |

Son los multiplicadores de **uso clínico habitual** sobre la TMB. Conceptualmente equivalen a los
niveles de actividad física (PAL) de FAO/OMS/UNU (2004), pero no son idénticos: los PAL del
informe (≈1.40–2.40) se definen sobre TMB medida y describen estilos de vida completos. Usamos la
escala clínica por convención y porque es la que el usuario reconoce.

`suggestActivityLevel({ trainingDaysPerWeek (0–14), work })` (regla propia, no de la literatura):
índice por sesiones (0 → 0; 1–2 → 1; 3–5 → 2; 6–7 → 3; ≥ 8 → 4) + bono por trabajo (sentado 0,
de pie 1, físico 2), con tope en «muy activo». Devuelve el motivo en español.

## 4. Cribado de riesgo (`risk.ts`)

`screenRisk({ ageYears, sex, bmi, healthFlags, goal })` → `{ level, flags, blocks, messages }`.
No diagnostica: solo decide bloqueos y redacta mensajes prudentes.

| Condición | Nivel | Déficit | Ayuno |
|---|---|---|---|
| Menor de 18 años | professional | bloqueado | bloqueado |
| Embarazo / lactancia | professional | bloqueado | bloqueado |
| IMC < 18.5 | professional | bloqueado | bloqueado |
| Antecedente de TCA | professional | bloqueado | bloqueado |
| Diabetes con medicación | professional | — | bloqueado |
| Enfermedad renal | professional | — | bloqueado |
| 65 años o más | caution | — | — |
| IMC ≥ 40 | caution | — | — |
| Otra condición (`other_condition`) | caution | — | — |

- `blocks.aggressiveGoals = level !== "ok"`: pérdida máxima 0.5 % del peso/semana y superávit
  máximo 10 %.
- `blocks.autoPlans = level === "professional"`: los planes automáticos requieren revisión
  profesional.
- Las banderas declaradas se respetan aunque el sexo de cálculo sea masculino.
- El IMC se compara redondeado a 1 decimal, igual que la clasificación OMS.
- Si el objetivo implica déficit y está bloqueado, se agrega «tu meta se calcula en mantenimiento».

## 5. Metas diarias (`targets.ts`)

`computeTargets(input)` → `{ method, bmr, tdee, goalAdjustmentKcal, expectedWeeklyChangeKg,
energyKcal, proteinG, fatG, carbsG, fiberG, waterMl, floorApplied, capApplied, bmi,
referenceWeightKg, risk, steps[{label, formula, value, unit}], assumptions[], warnings[] }`.

Pasos (cada uno usa el valor **redondeado** del anterior para que la explicación cuadre):

1. **TMB** (Mifflin-St Jeor), redondeada a 10 kcal.
2. **Gasto total (TDEE)** = TMB × factor de actividad, a 10 kcal.
3. **Ajuste por objetivo**
   - `lose_fat`: déficit = ritmo (kg/sem) × 7700 / 7. Ritmo por defecto 0.5 kg/sem si no se indica.
     El ritmo se limita a 0.25 %–1 % del peso por semana (0.5 % si `aggressiveGoals`) y el déficit a
     25 % del TDEE. Si manda el tope del 25 %, solo se avisa de ese tope.
   - `recomposition`: −10 % del TDEE.
   - `gain_muscle`: +15 % principiante, +10 % intermedio (o sin dato), +5 % avanzado; máximo 10 %
     si `aggressiveGoals`.
   - `maintain`, `improve_habits`: 0.
   - Si el riesgo bloquea el déficit (`lose_fat`/`recomposition`), el ajuste es 0 (mantenimiento) y no
     se aplican topes ni piso.
4. **Piso de seguridad** (solo con déficit): `máx(1200 mujer | 1500 hombre, TMB)`. Si el piso es
   ≥ TDEE, la meta queda en mantenimiento. Si el propio TDEE es < 1200/1500 se avisa que la meta queda
   por debajo y se sugiere consultar a un profesional (no se sube a un superávit).
5. **Calorías objetivo** a 10 kcal; `goalAdjustmentKcal = energyKcal − tdee` (ajuste efectivo).
   `expectedWeeklyChangeKg = ajuste × 7 / 7700` con déficit, 0 en mantenimiento, `null` con superávit
   (el costo energético de ganar músculo no se estima con 7700 kcal/kg).
6. **Peso de referencia**: con IMC ≥ 30 se usa el peso con IMC 25 a su talla (`25 × talla²`) para
   proteína y grasa mínima.
7. **Proteína** (g/kg de referencia): lose_fat 2.0, recomposition 2.2, gain_muscle 1.8, maintain 1.6,
   improve_habits 1.6 (rango 1.6–2.2; ISSN 2017). Con enfermedad renal: 0.8 g/kg como referencia
   (IDR general) y aviso de que la meta la define su médico o nutricionista.
8. **Grasa**: 25 % de las kcal (lose_fat, recomposition, gain_muscle) o 30 % (maintain,
   improve_habits), con mínimo de 0.6 g/kg de referencia.
9. **Carbohidratos**: `(kcal − 4 × proteína − 9 × grasa) / 4`. Nunca negativos: si lo serían, se baja
   la grasa a su mínimo, luego la proteína a 1.6 g/kg (0.8 con enfermedad renal) y, si aún no alcanza,
   quedan en 0 con aviso (`computeMacros`).
10. **Fibra**: 14 g por cada 1000 kcal.
11. **Agua**: ver `water.ts`.

Redondeos: kcal a 10, gramos a 1 g. `capApplied` = algún tope redujo el ajuste (ritmo, 25 % o
superávit). `floorApplied` = el piso subió la meta. Los mensajes del cribado van en `risk.messages`
(la UI debe mostrarlos además de `warnings`).

Para guardar en `nutrition_targets`: `energy_kcal`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`,
`water_ml`, `method = 'mifflin_st_jeor'` y en `inputs` los `steps`, `assumptions`, `warnings` y el
cribado.

## 6. Agua (`water.ts`)

Ingesta adecuada de **agua total** de EFSA (2010): 2000 ml/día mujer, 2500 ml/día hombre; +300 ml
en embarazo y +700 ml en lactancia (no se acumulan: se usa el mayor). Incluye el agua de los
alimentos (~20 %), así que el registro de bebidas cumple la meta con holgura. Con enfermedad renal se
avisa que los líquidos los indica su médico. `waterProgress` (avance con tope 100 %), `sumWaterMl`,
atajos de 250/500/750/1000 ml.

## 7. Unidades (`units.ts`)

- Masa: g, kg (1000 g), oz (28.349523125 g), lb (453.59237 g).
- Volumen: ml, l (1000 ml), taza 240 ml (taza de etiquetado nutricional), cda 15 ml, cdta 5 ml.
- Alias en español e inglés sin tildes («gramos», «kilos», «taza», «cucharadita», «cdta.»…).
- `toGrams(cantidad, unidad, { densityGPerMl?, portions? })`, en este orden:
  1. masa → directa;
  2. porción del alimento (`food_portions`: `quantity × unit = gramWeight`), por unidad o etiqueta —
     tiene prioridad sobre la densidad porque es específica del alimento;
  3. volumen con densidad → `ml × densidad`;
  4. si no: error explícito `missing_density` (volumen sin densidad) o `missing_portion` (medida
     casera sin porción definida). Nunca se asume densidad 1.
- `tryToGrams` (sin lanzar), `fromGrams` (inversa), `convertMass`, `convertVolume`, `formatQuantity`.

## 8. Porciones y recetas (`portions.ts`, `recipes.ts`)

- `scaleNutrients(per100g, gramos) = valor × gramos / 100` para los 8 núcleo (energía, proteína,
  carbohidratos, grasa obligatorios; fibra, azúcar, grasa saturada y sodio opcionales) y los
  micronutrientes por código (`nutrient_definitions.code`).
- `sumNutrients`: un opcional queda `null` solo si falta en todos los ítems; si falta en algunos, la
  suma es un **mínimo** y se marca en `incomplete` (equivale a `fiber_incomplete` de la vista
  `recipe_nutrition`). Igual para micronutrientes (`incompleteMicronutrients`).
- `recipeNutrition(ingredientes, porciones)` → totales, por porción, gramos totales y por porción.
- `scaleRecipe(ingredientes, de, a)` escala `grams` y `displayQuantity` (2 decimales) sin mutar.

## 9. Presupuesto del día (`energy-balance.ts`)

`dailyBudget({ targetKcal, exerciseKcal, countExercise, manualAdjustmentKcal, consumedKcal?,
minimumKcal? })` → `{ base, exercise, exerciseLogged, adjustments, total, minimumApplied,
consumed?, remaining, explanation[] }`.

- `total = base + (countExercise ? ejercicio neto : 0) + ajustes`.
- El ejercicio **solo suma si el usuario lo activa** (`profiles.count_exercise_calories`, falso por
  defecto): el factor de actividad de la meta ya incluye el ejercicio habitual y sumarlo de nuevo lo
  contaría dos veces. La explicación lo dice en ambos casos.
- `remaining` puede ser negativo: es información, no un castigo. `minimumKcal` opcional como piso.

## 10. Actividad física (`exercise.ts`)

```
kcal brutas = MET × peso(kg) × horas
kcal netas  = (MET − 1) × peso(kg) × horas
```

1 MET ≈ 3.5 ml O₂/kg/min ≈ 1 kcal/kg/h (gasto en reposo). Las netas restan ese reposo, que ya está en
el gasto diario: **el presupuesto usa las netas** y se le dice al usuario. Intensidad: ligera < 3 MET,
moderada 3–5.9, vigorosa ≥ 6. Límites: MET 1–25, duración 1–600 min (como `exercise_logs`), kcal a 1
decimal. Limitación: el MET estándar (3.5 ml O₂/kg/min) no considera la TMB individual (las ediciones
del Compendium describen una corrección por TMB que aquí no se aplica), la técnica ni el terreno; es una
estimación.

### Estado del catálogo (48 actividades)

Fuente objetivo: *2024 Adult Compendium of Physical Activities* (Herrmann et al., 2024;
pacompendium.com). **Ningún valor está verificado contra la tabla oficial** (`verified: false` en
cada entrada y en `EXERCISE_CATALOG_SOURCE`): el entorno de desarrollo no tuvo acceso a
pacompendium.com. Columna «Indicio 2024»: **sí** = el código y MET aparecieron en fragmentos de copias
secundarias de los documentos 2024 encontrados por búsqueda web (a veces contradictorios);
**no** = valor de ediciones anteriores del Compendium, sin contrastar con 2024. **Antes de producción
hay que cotejar cada fila con la tabla oficial** y marcar `verified: true`.

| Código | MET | Actividad | Indicio 2024 |
|---|---|---|---|
| 17152 | 2.8 | Caminar lento (3.2–3.9 km/h) | sí |
| 17170 | 3.0 | Caminar a paso de paseo (~4 km/h) | sí |
| 17190 | 3.5 | Caminar a ritmo moderado (4.5–5.5 km/h) | no (descripción sí, MET no) |
| 17200 | 4.8 | Caminar rápido (5.6–6.3 km/h) | sí |
| 17220 | 5.5 | Caminar muy rápido (6.4–7.0 km/h) | sí (fuentes contradictorias) |
| 17230 | 7.0 | Caminar a paso muy, muy rápido (7.2–7.9 km/h) | sí (fuentes contradictorias) |
| 17080 | 6.0 | Caminata de montaña (trekking) | no |
| 17133 | 4.5 | Subir escaleras a ritmo lento | sí |
| 17134 | 9.3 | Subir escaleras a ritmo rápido | sí |
| 12010 | 6.0 | Trotar y caminar alternando | sí |
| 12020 | 7.5 | Trotar a ritmo propio | sí (otra copia dice 7.0) |
| 12030 | 8.5 | Correr a 8.0–8.4 km/h | sí |
| 12050 | 9.3 | Correr a 9.7–10.1 km/h | sí |
| 12080 | 11.8 | Correr a ~12 km/h | sí |
| 01010 | 4.0 | Bicicleta recreativa (< 16 km/h) | sí |
| 01020 | 6.8 | Bicicleta 16–19 km/h | sí |
| 01030 | 8.0 | Bicicleta 19–22 km/h | sí |
| 01305 | 8.8 | Bicicleta: intervalos de alta intensidad (HIIT) | sí |
| 02014 | 6.8 | Bicicleta estática moderada | no (en 2024 podría tener otro código) |
| 18310 | 9.8 | Natación libre rápida | no |
| 18320 | 5.8 | Natación libre suave | no |
| 18350 | 6.0 | Nadar recreativo | no |
| 18355 | 5.3 | Aquaeróbicos | no |
| 02050 | 6.0 | Pesas intensas | sí |
| 02052 | 5.0 | Sentadillas / peso muerto | sí |
| 02054 | 3.5 | Rutina de varios ejercicios (8–15 rep.) | sí |
| 02020 | 7.5 | Calistenia intensa | sí |
| 02032 | 6.0 | Circuito con peso corporal | sí |
| 02040 | 7.0 | Circuito intenso con kettlebells | sí |
| 02048 | 5.0 | Elíptica moderada | sí |
| 02049 | 9.0 | Elíptica vigorosa | sí |
| 02071 | 5.0 | Remo en máquina moderado | sí |
| 02072 | 7.5 | Remo en máquina vigoroso | sí |
| 02150 | 2.3 | Yoga (hatha) | sí |
| 02103 | 1.8 | Pilates en colchoneta | sí |
| 15610 | 7.0 | Fútbol recreativo | sí |
| 15605 | 9.5 | Fútbol competitivo | sí |
| 15710 | 4.0 | Vóley recreativo | sí |
| 15725 | 8.0 | Vóley de playa | sí |
| 15055 | 6.5 | Básquet | no |
| 15675 | 7.3 | Tenis | no |
| 15551 | 11.8 | Saltar soga | no |
| 15430 | 10.3 | Artes marciales | no |
| 03015 | 7.3 | Aeróbicos | no |
| 03025 | 7.8 | Baile movido | no |
| 05010 | 3.3 | Barrer | no |
| 05021 | 3.5 | Trapear | no |
| 08245 | 3.8 | Jardinería | no |

## 11. Tendencia de peso (`weight-trend.ts`)

- Un pesaje por día (el último de esa fecha); fechas `YYYY-MM-DD`.
- **Promedio móvil de 7 días** que termina en cada pesaje; solo si hay **≥ 3 pesajes** en la ventana.
- **Regresión lineal** (mínimos cuadrados) de los promedios contra días desde el primero; ritmo
  semanal = pendiente × 7; `trendWeightKg` = valor de la recta en el último día; `r2`.
- Confianza: `insufficient` (sin recta), `low` (< 4 promedios o < 14 días), `ok`.
- **Proyección** a una meta: `días = (meta − peso de la recta) / pendiente`. `date = null` si la
  tendencia se aleja (`moving_away`), está estable (< 0.02 kg/sem, `flat`), faltan datos o la fecha
  queda a más de 730 días (`too_far`). Ya en la meta (± 0.1 kg) → `reached`. Es extrapolación lineal:
  el ritmo real suele desacelerarse (se dice en el mensaje).
- `comparePeriods`: promedio, mínimo y máximo de dos periodos y la diferencia (kg y %).

## 12. Adherencia (`adherence.ts`)

Criterios de la app (decisión de producto, no de la literatura):

- Día **registrado**: al menos un ítem.
- **kcal en meta**: dentro de ±10 % (bordes incluidos). **Proteína en meta**: ≥ 90 % (sin meta de
  proteína, no bloquea).
- **Racha de registro** (solo pide registrar: comer más no la rompe) y **racha de metas** (kcal y
  proteína), independientes. Hoy suma solo si ya cumple; si aún no, la racha sigue viva desde ayer.
  Se calculan la actual y la más larga; los días futuros se ignoran.
- **Adherencia semanal** (lunes a domingo): conteos y porcentajes sobre los días ya transcurridos.

## 13. Ayuno (`fasting.ts`)

- Protocolos 12:12, 14:10, 16:8, 18:6. Personalizados de 8 a 24 h (checks de `fasting_sessions`).
  **No hay protocolos de más de 24 h.**
- `fastingStatus`: transcurrido, restante, tiempo extra, progreso 0–1, `endsAt`, completado.
- `fastingStats`: sesiones completadas/canceladas/activas, tasa de completadas, promedio y mayor
  duración (de las completadas).
- `canStartFasting(risk, { hasActiveSession })`: no permite si `risk.blocks.fasting` ni si ya hay un
  ayuno activo; con nivel `caution` agrega los mensajes del cribado. Siempre recuerda terminar el ayuno
  ante mareo o malestar.

## 14. Planificador (`planner.ts`)

Determinista: misma entrada + misma `seed` = mismo plan (FNV-1a + mulberry32). **Nunca usa IA.**

1. **Filtros**: recetas inválidas o con id repetido se omiten; alérgenos (comparados sin tildes ni
   mayúsculas); patrón de dieta como filtro duro — vegetarian (acepta vegetarian/vegan), vegan,
   pescatarian (pescatarian/vegetarian/vegan), keto, low_carb (low_carb/keto) —; high_protein y
   mediterranean solo dan preferencia; `maxPrepMinutes` excluye también recetas sin tiempo registrado.
2. **Reparto de kcal**: 3 comidas 30/40/30 %; 4 comidas desayuno 25, almuerzo 35, media tarde 15,
   cena 25; 5 comidas desayuno 25, media mañana 7.5, almuerzo 35, media tarde 7.5, cena 25.
3. **Elección por comida** (menor puntaje): error relativo de kcal con las porciones óptimas + 0.5 ×
   déficit relativo de proteína + 0.15 × usos previos + 0.3 × exceso sobre el presupuesto de esa
   comida − 0.05 si coincide con el estilo preferido + 0.08 × azar con semilla. No repite receta en el
   mismo día; máximo 2 apariciones por plan (configurable). Si no hay opciones bajo el tope, lo relaja
   y lo avisa.
4. **Porciones** 0.5–2.5 en pasos de 0.25, ajustadas paso a paso para minimizar `|kcal día − meta|`
   (con un término menor de equilibrio entre comidas).
5. Si el día sigue fuera de ±10 %, **cambia recetas** (las kcal mandan sobre el costo). Si las kcal
   ya cuadran pero la proteína queda < 90 %, prueba cambios que suban la proteína sin salir de ±10 % ni
   del presupuesto de la comida.
6. **Diagnósticos** por día (kcal, % de desviación, dentro de tolerancia, proteína vs meta, comidas
   vacías y motivo) y del plan (recetas elegibles y excluidas por motivo, repeticiones relajadas, costo
   estimado, si es parcial, presupuesto proporcional a los días y si se excede; `overBudget = null` si
   el costo es parcial y no lo supera). Con recetas suficientes queda dentro de ±10 % (probado con
   varios objetivos, comidas por día y semillas).

## 15. Lista de compras (`shopping.ts`)

- `ingredientsFromPlan`: receta × (porciones del plan / porciones de la receta) o alimento suelto;
  informa recetas faltantes. `consolidateIngredients` suma gramos por alimento.
- Categorías: proteínas, lácteos, cereales y tubérculos, menestras, frutas, verduras, grasas, otros
  (acepta sinónimos en español; lo desconocido va a «otros»).
- Cantidad de compra (redondeo hacia arriba): < 1000 g en decenas de g, si no en décimas de kg; igual
  con ml/L si se compra por volumen y hay densidad; unidades enteras si hay peso por unidad.
- Costo con `reference_prices` (el más reciente en la moneda pedida): por kg con los gramos; por litro
  solo con densidad; por unidad con unidades enteras (necesita peso por unidad si no se compra por
  unidades). Cada ítem lleva `priceStatus` (`priced`, `no_price`, `needs_density`,
  `needs_unit_weight`, `other_currency`); el total es la suma de los que tienen precio y se marca
  como parcial si falta alguno. Siempre se aclara que los precios son referenciales.

## 16. Gamificación (`gamification.ts`)

- Criterios de insignias = `badges.criteria` del seed: `meal_log_items_total`, `logging_days`,
  `water_goal_days`, `protein_goal_days`, `vegetable_days`, `recipes_created`, `weight_logs_total`,
  `log_source_used`, `meal_plans_created`, `challenges_completed`. Días **distintos**, no
  consecutivos. Criterios desconocidos no se otorgan. Una insignia ganada no se pierde.
- `aggregateHabitDays`: días con registro, agua ≥ meta, proteína ≥ 90 % de la meta (mismo criterio que
  la adherencia) y con verduras.
- Retos: suman días desde `started_on` en que el valor diario ≥ `target_value` (agua ml, ítems,
  % de la meta de proteína, porciones de verdura, minutos) hasta llegar a `duration_days`. Saltarse un
  día no reinicia nada; no existe el estado «fallido» y los mensajes son siempre amables.

---

## Referencias

- Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO. A new predictive equation for
  resting energy expenditure in healthy individuals. *Am J Clin Nutr*. 1990;51(2):241–247.
- FAO/WHO/UNU. *Human energy requirements*. Report of a Joint FAO/WHO/UNU Expert Consultation.
  FAO Food and Nutrition Technical Report Series 1. Rome; 2004. (Niveles de actividad física; los
  factores 1.2–1.9 son los de uso clínico habitual.)
- Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: A third
  update of the energy costs of human activities. *J Sport Health Sci*. 2024;13(1):6–12.
  https://pacompendium.com
- Jäger R, Kerksick CM, Campbell BI, et al. International Society of Sports Nutrition Position Stand:
  protein and exercise. *J Int Soc Sports Nutr*. 2017;14:20.
- U.S. Department of Agriculture, U.S. Department of Health and Human Services. *Dietary Guidelines
  for Americans, 2020–2025* (fibra: 14 g por cada 1000 kcal).
- EFSA Panel on Dietetic Products, Nutrition, and Allergies. Scientific Opinion on Dietary Reference
  Values for water. *EFSA Journal*. 2010;8(3):1459.
- National Heart, Lung, and Blood Institute (NHLBI). *Clinical Guidelines on the Identification,
  Evaluation, and Treatment of Overweight and Obesity in Adults* (1998) y *The Practical Guide* (2000):
  dietas de pérdida de peso de unas 1000–1200 kcal/día para la mayoría de mujeres y de 1200 a
  1500–1600 kcal/día para hombres (según la versión del documento). ORANGE FIT usa 1200 y 1500 kcal como
  **pisos** prudentes sin supervisión, no como metas.
- Hall KD. What is the required energy deficit per unit weight loss? *Int J Obes (Lond)*.
  2008;32(3):573–576. (Limitación de la regla de ~7700 kcal/kg: el contenido energético del cambio de
  peso depende de la composición corporal y del peso inicial, y la pérdida se desacelera con el tiempo.)
- World Health Organization. *Obesity: preventing and managing the global epidemic*. WHO Technical
  Report Series 894. Geneva; 2000. (Cortes del IMC.)
- Institute of Medicine. *Dietary Reference Intakes for Energy, Carbohydrate, Fiber, Fat, Fatty Acids,
  Cholesterol, Protein, and Amino Acids*. 2005. (0.8 g/kg de proteína como referencia general.)

## Supuestos y decisiones propias

- Redondeo: kcal a 10, gramos a 1, en cadena (cada paso usa el anterior redondeado).
- Ritmo por defecto 0.5 kg/sem para `lose_fat` sin dato; ritmo mínimo 0.25 % del peso/semana.
- Con perfil de precaución: pérdida máxima 0.5 % del peso/semana y superávit máximo 10 %.
- «65 años o más» como corte de adulto mayor (inclusivo en 65).
- Enfermedad renal: 0.8 g/kg de proteína solo como referencia y aviso (la meta la define su
  profesional); planes automáticos sujetos a revisión.
- El agua de EFSA es agua total; se registra solo bebida.
- Adherencia: ±10 % de kcal y ≥ 90 % de proteína.
- Tendencia: ventana de 7 días, mínimo 3 pesajes, proyección máxima 730 días, «estable» < 0.02 kg/sem.
- Planificador: pesos del puntaje, tope de 2 repeticiones por plan, reparto por comida (ver §14).
- Catálogo de actividad física **pendiente de verificación** (ver §10).
