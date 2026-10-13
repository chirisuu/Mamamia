# Módulo seguimiento (progreso, fotos, agua, ayuno, actividad, logros, notificaciones)

Dueño de: `/app/progreso`, `/app/progreso/fotos`, `/app/agua`, `/app/ayuno`, `/app/actividad`,
`/app/logros`, `/app/notificaciones`, `/api/push/subscribe`, `/api/cron/reminders`. Código en
`src/features/{progress,water,fasting,activity,gamification,notifications}/` y
`src/lib/notifications/`. Arquitectura de Apple Health / Health Connect: `docs/INTEGRATIONS.md`.

Todas las pantallas: Server Component que lee con el cliente de sesión (RLS) vía
`getTrackingContext()` (sesión, perfil, zona horaria, «hoy» del usuario, objetivo activo y si hay
antecedente de TCA), `loading.tsx` con `Skeleton` + `aria-busy`, `error.tsx` con reintentar
(`retry`) y estado vacío/error dentro de la página. Escrituras con Server Actions
(`requireUser` + Zod + RLS + `revalidatePath` + `ActionResult`). Las acciones de agua, peso y
actividad evalúan logros en segundo plano con `after()`.

## Qué quedó funcional

### Progreso (`/app/progreso`)
- Peso: un registro por día (upsert `user_id,local_date`; si ya existe se reemplaza y se avisa),
  fechas de hasta 5 años atrás, nunca futuras. % de grasa opcional **siempre** con método
  (bioimpedancia, plicómetro, cinta, visual, otro) y rotulado «estimación no clínica».
- Gráfico Recharts: pesaje diario (puntos) + promedio móvil de 7 días (línea) + meta (punteada) y
  tabla `sr-only` equivalente. Rangos 30/90 días gratis; 6 meses y 1 año con `advanced_analytics`.
- Tendencia (`weightTrend` sobre las últimas 6 semanas): ritmo semanal, peso de tendencia,
  confianza; proyección a la meta (`projectGoalDate`) con su motivo cuando no hay fecha
  («aún faltan pesajes», «se aleja», «estable», «muy lejos»). Sin promesas de resultados.
- Comparación de periodos 7/30/90 días (`comparePeriods`) dentro de `<PremiumGate feature="advanced_analytics">`.
- Medidas (cintura, cadera, pecho, brazo, muslo, pantorrilla, cuello): un registro por día, historial
  con borrar, gráfico por medida (30 días gratis; historial completo con Premium).
- Adherencia de la semana (`weeklyAdherence`, `computeStreaks`) con la meta vigente de cada día; días
  sin meta no cuentan como fallidos.
- Con antecedente de TCA: no se muestran números de peso, medidas ni proyecciones (solo hábitos).

### Fotos de progreso (`/app/progreso/fotos`)
- Requiere el consentimiento vigente `progress_photos` (`latestConsents` + `isConsentActive`). Sin él
  se explica y se puede otorgar ahí mismo (nueva fila en `consents`, versión `CONSENT_VERSION`); se
  retira en Privacidad. Si se retiró, se pueden ver y borrar las fotos existentes pero no subir nuevas.
- Flujo: cámara (`capture="environment"`) o galería → compresión en el navegador (canvas, máx. 1600 px,
  WebP 0.82; JPEG si el navegador no codifica WebP; se pierden los EXIF/GPS) → `preparePhotoUploadAction`
  (revisa permiso, fecha y tope de 8 por día; **el servidor decide la ruta**
  `{uid}/{fecha}-{pose}-{aleatorio}.webp`) → subida con el cliente del navegador (RLS de Storage) →
  `savePhotoAction` (valida que la ruta sea del usuario y coincida con fecha/pose, que el archivo exista
  y que el permiso siga vigente; si falla, borra el archivo) → fila en `progress_photos`.
- Listado con URLs firmadas de 1 h generadas en el servidor (`createSignedUrls`), `<img>` sin pasar por
  el optimizador (no se cachean) y `referrerPolicy="no-referrer"`. Comparación lado a lado de dos
  fechas por pose. Borrar = objeto del bucket + fila. Bucket privado: nunca hay URLs públicas.

### Agua (`/app/agua`)
- Accesos rápidos 250 / 500 / 750 ml y personalizado (50–2000 ml), meta de `nutrition_targets.water_ml`
  vigente, progreso del día, deshacer (último del día y desde el toast), borrar cada registro,
  historial 7/30 días (barras + meta; los días sin registro no se dibujan como 0) y recordatorios
  opcionales (`profiles.notification_prefs.water`). Aviso de enfermedad renal si aplica.

### Ayuno (`/app/ayuno`)
- Protocolos 12:12, 14:10, 16:8, 18:6 y personalizado (8–24 h en pasos de 0.5). «¿Cuándo dejaste de
  comer?» (ahora o hasta hace 4 h). Iniciar / terminar (queda con su duración real, llegue o no a la
  meta) / cancelar (no cuenta en estadísticas). Temporizador persistente: el estado sale de
  `fasting_sessions.started_at`; el reloj corre en el cliente.
- **Bloqueo**: `fastingEligibility` = `screenRisk` (edad, sexo, IMC con el último pesaje o el peso del
  objetivo, `health_flags`) + `canStartFasting`. Menor de edad, embarazo, lactancia, IMC < 18.5, TCA,
  diabetes con medicación y enfermedad renal → no se puede iniciar y se explica con amabilidad. Si
  faltan datos para el cribado, por prudencia tampoco (se pide completar el perfil). El servidor
  recalcula el cribado al iniciar (no confía en el cliente); el índice único garantiza una sola activa.
- Historial (30 últimos) y estadísticas (`fastingStats` + cuántos llegaron a su meta). Aviso de
  seguridad visible siempre.
- Aviso al completar: notificación local (Notification API, una vez por ayuno, con la app abierta y
  permiso concedido; botón para pedir permiso) y, vía cron, notificación en la app + push si VAPID está
  configurado (`notification_prefs.fasting`, activado por defecto).

### Actividad (`/app/actividad`)
- Catálogo MET (`EXERCISE_CATALOG`, 48 actividades) con búsqueda sin tildes, filtro por categoría e
  intensidad (la intensidad se deriva del MET de la variante elegida). Duración 1–600 min, fecha hasta
  60 días atrás. Peso: último pesaje hasta esa fecha o, si no hay, el del objetivo; sin peso no se
  estima (se pide registrarlo).
- Se guardan **kcal netas** `(MET − 1) × kg × h` calculadas en el servidor (`energy_source =
  'met_estimate'`), con vista previa de la fórmula (brutas y netas) y la explicación del motor. Con
  antecedente de TCA la explicación no muestra el número de peso.
- Opción «De mi reloj o app»: nombre, intensidad y calorías activas copiadas a mano (`energy_source =
  'manual'`, sin MET, tope 3000 kcal).
- Historial agrupado por día con borrar; resumen de hoy y de la semana.
- Interruptor «Sumar ejercicio a mi presupuesto» (`profiles.count_exercise_calories`) con la
  explicación del doble conteo. Aviso explícito: hoy no hay sincronización con Apple Health / Health
  Connect.

### Logros (`/app/logros`)
- Al abrir se evalúa todo en el servidor (`syncAchievements`) sobre agregados reales: diario (ítems,
  orígenes, desayunos, verduras por nombre), `daily_nutrition_totals` (proteína), agua, ejercicio,
  recetas, pesajes, planes y retos completados; usa `evaluateBadges` / `evaluateChallenge`.
  Otorga insignias nuevas (`user_badges`, upsert idempotente) y completa retos (update condicionado a
  `status='active'`), con una notificación por logro nuevo (solo el proceso que lo insertó la crea).
- Insignias ganadas y en camino (barra «3 de 7»); con TCA no se invita a la insignia de pesaje.
- Retos voluntarios: unirse, dejar (sin castigo; «Hacerlo otra vez» si ya se completó), avance en días
  (no tienen que ser seguidos). El de agua usa la meta de agua de la persona si la tiene; el de
  verduras avisa que se reconocen por nombre (aproximación, 1 porción = 80 g).

### Notificaciones (`/app/notificaciones`, CONTRATO 5)
- Lista (vencidas, más recientes primero), abrir = marcar leída y navegar a su `url` interna, marcar
  todas como leídas; preferencias de recordatorios (registro de comidas, pesaje semanal —oculto con
  TCA—, aviso de ayuno); activar/desactivar push en este dispositivo y notificación de prueba.
- `src/lib/notifications/notify.ts`: `createNotification(supabase, userId, { type, title, body, url?,
  scheduledFor? })` (nunca lanza; `{ ok, id }` o `{ ok:false, code, message }`; `url` debe ser ruta
  interna) y `sendDuePushNotifications(admin, { now?, maxAgeHours? })` (pendientes de las últimas 24 h,
  marca `sent_at`, borra suscripciones 404/410; sin VAPID devuelve `configured:false` y no envía).
- `POST /api/push/subscribe` (401 sin sesión, 400 inválido, 429 rate limit 20/h, 503 sin VAPID; usa
  `register_push_subscription`) y `DELETE` (`{ endpoint }`, solo las propias).
- `GET /api/cron/reminders` con `Authorization: Bearer CRON_SECRET` (401 sin/otro secreto, 503 sin
  `CRON_SECRET` o sin service role): crea los recordatorios debidos según `notification_prefs` en la
  hora local de cada usuario, sin repetir (agua por intervalo, registro/pesaje una vez al día, ayuno una
  vez por sesión) y sin pedir lo que ya se hizo; luego envía push pendientes. Payload push
  `{ title, body, url }` para `public/sw.js` (lo escribe landing).

## Qué requiere credenciales / configuración
- **Push**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`npx web-push
  generate-vapid-keys`). Sin ellas la UI dice «pendiente de configurar» y todo queda dentro de la app.
- **Cron**: `CRON_SECRET` (≥ 16 caracteres) + `SUPABASE_SERVICE_ROLE_KEY`, y programar
  `GET /api/cron/reminders` cada 15–60 min con el header `Authorization: Bearer …` (Vercel Cron o
  externo). Sin `CRON_SECRET` la UI de recordatorios lo avisa.
- **Service worker** (`public/sw.js`, módulo landing): debe mostrar `{ title, body, url }` en `push` y
  abrir `data.url` en `notificationclick`. La notificación local del ayuno usa `data: { url }`.

## Qué falta / limitaciones conocidas
- Sin sincronización con Apple Health / Health Connect (ver `docs/INTEGRATIONS.md`).
- El catálogo MET está pendiente de cotejo con la tabla oficial del Compendium (lo indica la UI).
- Verduras para retos/insignias: reconocimiento por nombre (no hay categoría en `foods`).
- Los logros por registros hechos en otras pantallas (diario, recetas, planes) se otorgan al abrir
  `/app/logros` o al registrar agua/peso/actividad; el diario no llama a `syncAchievements`.
- La política RLS permite al usuario insertar en `user_badges` y actualizar `user_challenges`
  directamente por la API (contrato del modelo de datos); las insignias no tienen valor económico.
- No hay e2e de la cámara/compresión (depende de canvas del navegador); se cubre con pruebas de
  integración de Storage y unitarias de rutas.

## Pruebas
- Unitarias: `src/features/progress/lib/{analytics,photo-path}.test.ts` (proyección, ventanas,
  adherencia, rutas), `src/features/fasting/lib/{eligibility,fasting-view}.test.ts` (bloqueos de ayuno),
  `src/features/water/lib/water-stats.test.ts`, `src/features/activity/lib/activity-calc.test.ts`
  (kcal netas, sin doble conteo), `src/features/gamification/lib/habits.test.ts` (agregados, verduras,
  insignias, retos), `src/lib/notifications/reminders.test.ts` (preferencias y reglas del cron).
- Integración: `tests/integration/seguimiento.test.ts` — peso upsert por día; fotos (sin permiso no
  sube, subir/guardar/leer propia con URL firmada, otro usuario no puede leer/firmar/listar/registrar ni
  subir a la carpeta ajena, no hay URL pública, borrar archivo + fila); ayuno (una sola activa, también a
  nivel de base con 23505; bloqueo por embarazo); cron sin secreto → 401, con secreto → 200 y
  recordatorio sin duplicar.
