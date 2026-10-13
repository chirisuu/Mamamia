# Integraciones de salud — Apple Health y Health Connect

> **Estado actual: NO hay sincronización.** ORANGE FIT es hoy una web/PWA. Un navegador no puede leer
> Apple Health (HealthKit) ni Health Connect (Android): ambas APIs son nativas. Todo lo de abajo es
> la arquitectura prevista para un adaptador futuro dentro de una app nativa (Capacitor). Ninguna
> pantalla debe insinuar que la sincronización existe. En `/app/actividad` se dice explícitamente que
> hoy no hay sincronización y se ofrece copiar a mano las calorías activas del reloj
> (`exercise_logs.energy_source = 'manual'`).

## 1. Qué datos tendría sentido intercambiar

| Dato | Dirección | Tabla destino | Notas |
|---|---|---|---|
| Entrenamientos (tipo, inicio, duración) | Leer | `exercise_logs` | `energy_source = 'device'`, `activity_code = 'device:<tipo>'` |
| Energía activa del entrenamiento | Leer | `exercise_logs.energy_kcal` | Solo energía **activa** (equivale a kcal netas). Nunca la energía total/basal: duplicaría la TMB |
| Peso corporal | Leer (y opcional escribir) | `weight_logs` | Un pesaje por día (`unique (user_id, local_date)`): si ya hay uno manual, gana el manual salvo que el usuario elija lo contrario |
| % de grasa | Leer | `weight_logs.body_fat_pct` | Siempre etiquetado como estimación no clínica, `body_fat_method = 'device'` |
| Agua | Leer / escribir | `water_logs` | Evitar eco: lo que escribimos no se vuelve a importar (ver §4) |
| Pasos | Leer (solo mostrar) | — | No se convierten en kcal sumables: el factor de actividad ya los cubre |
| Nutrición (kcal, macros) | Escribir (opcional) | — | Exportar el diario como `dietaryEnergyConsumed`/`NutritionRecord`; nunca importar |

No se leen: frecuencia cardiaca, sueño, ciclo menstrual, glucosa ni datos clínicos. Si algún día se
necesitan, requieren un análisis aparte (son datos sensibles con más riesgo que beneficio aquí).

## 2. Arquitectura propuesta

```
┌────────────── App nativa (Capacitor) ──────────────┐
│  WebView con la app Next.js (misma UI)             │
│      │  window.OrangeFitHealth (puente JS)         │
│      ▼                                             │
│  Plugin HealthBridge (Swift / Kotlin)              │
│   - iOS: HealthKit (HKHealthStore)                 │
│   - Android: Health Connect (HealthConnectClient)  │
└──────────────┬─────────────────────────────────────┘
               │ lotes normalizados (JSON)
               ▼
      POST /api/health/sync  (route handler, sesión del usuario)
               │ Zod + requireUser + RLS (cliente de servidor, nunca service role)
               ▼
   exercise_logs / weight_logs / water_logs  (+ tabla health_sync_state)
```

- **Adaptador por plataforma** con una interfaz común en TypeScript (`src/lib/health/adapter.ts`):
  `isAvailable()`, `requestPermissions(scopes)`, `getGrantedScopes()`, `readWorkouts(since)`,
  `readWeights(since)`, `readWater(since)`, `writeWater(entry)`, `revoke()`. Implementaciones:
  `NativeHealthAdapter` (puente Capacitor) y `UnavailableHealthAdapter` (web: devuelve
  `isAvailable() = false` y la UI muestra «disponible solo en la app»). Nada de datos simulados.
- **Normalización en el cliente nativo** a unidades canónicas (kg, ml, kcal, minutos) y a la
  `local_date` del perfil (zona horaria del usuario, no la del dispositivo si difieren).
- **Servidor como única puerta**: el endpoint valida cada registro, aplica los mismos rangos que la
  base (peso 20–400 kg, agua 1–5000 ml, duración 1–600 min, kcal 0–10000) y escribe con RLS.
- **Idempotencia**: cada registro externo trae `external_id` (UUID de HealthKit / id de Health
  Connect). Migración aditiva futura: columnas `external_source text` y `external_id text` con
  índice único parcial `(user_id, external_source, external_id)` en las tablas destino.
- **Estado de sincronización** (`health_sync_state`: user_id, platform, scopes, last_synced_at,
  anchor/token de cambios) para leer solo lo nuevo (HKAnchoredObjectQuery / changes token).

## 3. Permisos explícitos y consentimiento

1. El usuario activa la integración desde Perfil → Privacidad → «Conectar Apple Health / Health
   Connect». Nada se pide al instalar.
2. Pantalla previa propia que explica, por tipo de dato, qué se lee/escribe y para qué. Luego el
   diálogo del sistema (HealthKit / Health Connect) con **solo** los scopes elegidos.
3. Nuevo tipo de consentimiento (`consent_type = 'health_sync'`, migración aditiva) con versión, en
   el historial de `consents`. Retirarlo detiene la sincronización y ofrece borrar lo importado
   (filas con `energy_source = 'device'` / `external_source`).
4. Se respeta lo que el sistema conceda: si el usuario niega un scope en el diálogo nativo, ese dato
   no se sincroniza y la UI lo indica (HealthKit no revela permisos de lectura denegados: se trata
   «sin datos» como posible falta de permiso y se dice así).
5. Health Connect exige una política de privacidad enlazada y declarar cada permiso en el manifest;
   Apple exige las claves `NSHealthShareUsageDescription` / `NSHealthUpdateUsageDescription` y no
   permite usar los datos de HealthKit para publicidad.

## 4. Reglas de negocio que se mantienen

- **Sin doble conteo**: las kcal de entrenamientos importados se guardan como netas y solo suman al
  presupuesto si `profiles.count_exercise_calories` está activo (igual que las manuales).
- **Sin eco**: lo que ORANGE FIT escribe en la plataforma lleva metadatos de origen
  (`HKMetadataKeyExternalUUID` / `metadata.clientRecordId`) y se ignora al leer.
- **Conflictos de peso**: un pesaje por día; el registro manual del día manda.
- **Perfiles de riesgo**: con antecedente de TCA no se muestran números de peso aunque vengan del
  dispositivo (misma regla que `/app/progreso`).
- **Logs** sin datos de salud: solo ids, conteos y códigos de error.

## 5. Qué falta para implementarlo

1. Empaquetar la PWA con Capacitor (iOS y Android) y crear el plugin `HealthBridge`.
2. Migraciones aditivas: `external_source`/`external_id`, `health_sync_state`, consentimiento
   `health_sync`.
3. `POST /api/health/sync` + `src/lib/health/*` + pantalla de conexión en Privacidad.
4. Pruebas en dispositivos reales (los simuladores no tienen todos los tipos de datos).
