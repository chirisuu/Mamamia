# Modelo de datos — ORANGE FIT

Postgres (Supabase). Contrato entre migraciones y código. `id uuid primary key default
gen_random_uuid()`, `created_at/updated_at timestamptz default now()` salvo que se diga otra cosa.
Todas las tablas de `public` tienen **RLS activado**. `user_id` siempre referencia
`auth.users(id) on delete cascade`.

## Convenciones
- Energía kcal; masa g; volumen ml; alimentos por 100 g; peso corporal kg; medidas cm.
- `local_date date` = día del usuario según `profiles.timezone`. Instantes en `timestamptz` UTC.
- Montos de dinero en `numeric(10,2)` con `currency_code char(3)` (precios referenciales) y en
  `amount_cents integer` para cobros reales.

## Enums
| enum | valores |
|---|---|
| app_role | superadmin, admin, editor, professional |
| sex_for_calc | male, female |
| activity_level | sedentary, light, moderate, active, very_active |
| goal_type | lose_fat, gain_muscle, maintain, recomposition, improve_habits |
| meal_type | breakfast, lunch, dinner, snack, custom |
| log_source | manual, search, barcode, photo_ai, voice_ai, text_ai, recipe, plan, template, copy |
| food_source | usda, open_food_facts, curated, user, admin |
| verification_status | unverified, curated, verified, rejected |
| recipe_status | draft, pending_review, published, rejected |
| subscription_status | trialing, active, past_due, canceled, incomplete, paused, expired |
| billing_provider | stripe, mercadopago |
| billing_interval | month, year |
| ai_request_kind | photo, text, voice, chat, plan |
| ai_request_status | pending, succeeded, failed, rejected_quota, not_configured |
| consent_type | terms, privacy, health_data, ai_processing, progress_photos, marketing |
| fasting_status | active, completed, cancelled |
| photo_pose | front, side, back, other |

## Usuarios
**profiles** — `id uuid pk → auth.users`, display_name text, birth_date date, sex sex_for_calc,
height_cm numeric(5,1) check 100–250, timezone text default 'America/Lima', country_code char(2)
default 'PE', currency_code char(3) default 'PEN', locale text default 'es-PE',
onboarding_completed_at timestamptz, avatar_path text, notification_prefs jsonb default '{}',
count_exercise_calories boolean default false, created_at, updated_at.
Se crea por trigger al registrarse (`handle_new_user`, toma `display_name` de raw_user_meta_data).

**user_roles** — user_id, role app_role, granted_by uuid, granted_at; pk(user_id, role).
Solo superadmin escribe (admin no puede otorgar superadmin).

**consents** — id, user_id, consent_type, version text, granted boolean, granted_at, revoked_at,
created_at. Historial: la fila más reciente por tipo manda.

**user_goals** — id, user_id, goal_type, current_weight_kg numeric(5,2), target_weight_kg
numeric(5,2), weekly_rate_kg numeric(4,2) (magnitud ≥ 0), activity_level, training_days_per_week
smallint 0–14, diet_pattern text (omnivore|vegetarian|vegan|pescatarian|keto|low_carb|high_protein|
mediterranean), allergies text[], intolerances text[], restrictions text[], disliked_foods text[],
weekly_budget numeric(10,2), budget_currency char(3), meals_per_day smallint 2–6,
nutrition_experience text (beginner|intermediate|advanced), health_flags text[] (pregnant,
lactating, eating_disorder_history, diabetes_medication, kidney_disease, other_condition),
requires_professional_review boolean default false, is_active boolean default true, created_at.
Índice único parcial: un objetivo activo por usuario.

**nutrition_targets** — id, user_id, effective_from date, energy_kcal int, protein_g int, carbs_g
int, fat_g int, fiber_g int, water_ml int, method text default 'mifflin_st_jeor', inputs jsonb
(fórmula, valores y supuestos), source text (auto|manual|professional), notes text, created_by
uuid, created_at. Vigente = mayor effective_from ≤ hoy, desempate created_at.

**professional_access** — id, professional_id uuid, user_id uuid, scope text default
'read_logs_write_targets', granted_at, revoked_at. El usuario la crea y la revoca; el profesional
(rol professional) puede leer registros y escribir `nutrition_targets` con source 'professional'
mientras esté vigente.

## Alimentos
**brands** — id, name, name_normalized unique.

**foods** — id, name, name_normalized, brand_id, description, food_type text (generic|branded|dish),
barcode text null (único entre públicos y, aparte, por dueño entre propios — ver Notas),
country_codes text[] default '{}', energy_kcal numeric(7,2), protein_g
numeric(6,2), carbs_g numeric(6,2), fat_g numeric(6,2), fiber_g, sugar_g, saturated_fat_g
numeric(6,2) null, sodium_mg numeric(8,2) null, density_g_per_ml numeric(5,3) null, source
food_source, source_ref text, source_url text, license text, verification_status default
'unverified', verified_by, verified_at, created_by uuid null (dueño si es alimento propio),
is_public boolean default false, search tsvector (generado: name+brand), created_at, updated_at.
Valores por 100 g; checks ≥ 0 y energy_kcal ≤ 900. Índices: trigram en name_normalized, GIN en
search, barcode. Extensiones: pg_trgm, unaccent.
Lectura: públicos para todos (incluido anon) + los propios. Escritura: el dueño (propios, nunca
`is_public`) y staff (editor+).

**nutrient_definitions** — id smallint identity, code text unique, name_es, unit (g|mg|µg).
**food_nutrients** — food_id, nutrient_id, amount_per_100g numeric; pk(food_id, nutrient_id).
Solo micronutrientes: los 8 núcleo viven en `foods`.
**food_portions** — id, food_id, label text ('1 taza'), quantity numeric default 1, unit text,
gram_weight numeric > 0, is_default boolean.
**reference_prices** — id, food_id null, item_name, country_code, currency_code, price
numeric(10,2), per_quantity numeric, per_unit text (kg|l|unit), source text, observed_on date,
created_by. Precio referencial, nunca "en tiempo real".

## Recetas y planes
**recipes** — id, owner_id uuid null (null = oficial), title, slug unique, description, servings
numeric(4,1) > 0, prep_minutes, cook_minutes, difficulty text (easy|medium|hard), steps jsonb
(array de textos), image_path text, tags text[], diet_tags text[], allergens text[], meal_types
meal_type[], country_code, estimated_cost numeric(10,2) null, cost_currency char(3), status
recipe_status, is_public boolean, reviewed_by, reviewed_at, created_at, updated_at.
Lectura: publicadas y públicas, o propias. Escritura: dueño; publicar solo staff.
**recipe_ingredients** — id, recipe_id, food_id, grams numeric > 0, display_quantity numeric,
display_unit text, note, position int.
**recipe_nutrition** (vista, security_invoker) — recipe_id, total_* y per_serving_* (kcal,
proteína, carbos, grasa, fibra) calculados de ingredientes × foods.

**user_favorites** — id, user_id, food_id null, recipe_id null; check exactamente uno; únicos parciales.
**meal_templates** — id, user_id, name, meal_type, created_at.
**meal_template_items** — id, template_id, user_id, food_id null, recipe_id null, grams numeric
null, servings numeric null, position.

**meal_logs** — id, user_id, local_date, meal_type, custom_name text null, created_at. Único
(user_id, local_date, meal_type, coalesce(custom_name,'')).
**meal_log_items** — id, meal_log_id, user_id, food_id null, recipe_id null, name, brand_name,
quantity numeric, unit text, grams numeric, energy_kcal numeric(8,2), protein_g, carbs_g, fat_g
numeric(7,2), fiber_g, sugar_g numeric(7,2) null, sodium_mg numeric(9,2) null, micronutrients jsonb
default '{}', source log_source, data_provenance text, ai_request_id uuid null, confidence
numeric(3,2) null, is_estimate boolean default false, created_at, updated_at.
**daily_nutrition_totals** (vista, security_invoker) — user_id, local_date, energy_kcal, protein_g,
carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, items_count.

**meal_plans** — id, user_id, name, start_date, days smallint 1–14, status text
(draft|active|archived), generator text (engine|manual), params jsonb, share_token text unique
null, shared_at, created_at, updated_at.
**meal_plan_items** — id, plan_id, user_id, day_index smallint, meal_type, recipe_id null, food_id
null, servings numeric null, grams numeric null, energy_kcal, protein_g, carbs_g, fat_g, position.
Lectura por `share_token` solo vía función `get_shared_plan(token)` (security definer).

**shopping_lists** — id, user_id, meal_plan_id null, name, currency_code, budget numeric(10,2)
null, share_token text unique null, created_at, updated_at.
**shopping_list_items** — id, list_id, user_id, food_id null, name, category text, quantity
numeric, unit text, checked boolean default false, estimated_price numeric(10,2) null,
price_source text (reference|user) null, position.

## Seguimiento
**water_logs** — id, user_id, local_date, amount_ml int 1–5000, logged_at.
**weight_logs** — id, user_id, local_date, weight_kg numeric(5,2) 20–400, body_fat_pct numeric(4,1)
null, body_fat_method text null, note, created_at; único (user_id, local_date).
**body_measurements** — id, user_id, local_date, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm,
calf_cm, neck_cm numeric(5,1) null, note, created_at; único (user_id, local_date).
**progress_photos** — id, user_id, local_date, storage_path, pose photo_pose, note, created_at.
**fasting_sessions** — id, user_id, protocol text (12:12|14:10|16:8|18:6|custom), target_hours
numeric(4,1) 8–24, started_at, ended_at null, status fasting_status, note. Una activa por usuario.
**exercise_logs** — id, user_id, local_date, activity_code, activity_name, met numeric(4,1),
duration_min int 1–600, intensity text (light|moderate|vigorous), energy_kcal numeric(7,1),
energy_source text (met_estimate|manual|device), note, created_at.

## IA
**ai_analysis_requests** — id, user_id, kind, provider, model, status, input_storage_path null,
output jsonb, error_code, tokens_input, tokens_output, estimated_cost_usd numeric(10,6),
latency_ms, created_at. No guarda texto libre del usuario fuera de `output`.
**assistant_conversations** — id, user_id, title, created_at, updated_at.
**assistant_messages** — id, conversation_id, user_id, role text (user|assistant), content, flagged
boolean default false, created_at.

## Notificaciones y gamificación
**notifications** — id, user_id, type, title, body, url, scheduled_for, sent_at, read_at, created_at.
**push_subscriptions** — id, user_id, endpoint unique, p256dh, auth, created_at.
**badges** — id, code unique, name, description, icon text (nombre lucide), criteria jsonb, is_active.
**user_badges** — user_id, badge_id, earned_at; pk(user_id, badge_id).
**challenges** — id, code unique, title, description, kind text (water|logging|protein|vegetables|
activity), target_value numeric, duration_days int, is_active.
**user_challenges** — id, user_id, challenge_id, started_on date, status (active|completed|
abandoned), progress jsonb, completed_at.

## Planes y pagos
**plans** — id text pk (free|premium), name, description, features text[], ai_monthly_limits jsonb
(`{"photo":n,"text":n,"voice":n,"chat":n}`), is_active, sort_order.
**plan_prices** — id, plan_id, interval billing_interval, currency_code, amount_cents int,
trial_days int default 0, stripe_price_id null, mercadopago_plan_id null, is_active, created_at.
**subscriptions** — id, user_id, plan_id, price_id null, provider, provider_customer_id,
provider_subscription_id unique, status, current_period_start, current_period_end, trial_end,
cancel_at_period_end boolean, canceled_at, created_at, updated_at. Escribe solo service role.
**payments** — id, user_id, subscription_id null, provider, provider_payment_id unique,
amount_cents, currency_code, status text (succeeded|pending|failed|refunded), paid_at, created_at.
Nunca datos de tarjeta.
**billing_events** — id, provider, event_id, type, processed_at; único (provider, event_id)
(idempotencia de webhooks). Solo service role.

## Administración
**app_settings** — key text pk, value jsonb, description, is_public boolean default true,
updated_by, updated_at. Claves: app_name, support_email, feature_flags, default_trial_days,
maintenance_banner. Lectura pública de claves con `is_public` (las sensibles: false); escritura admin.
**content_pages** — id, slug unique, title, body_md, kind (faq|legal|landing_block|article),
status (draft|published), sort_order, updated_by, updated_at.
**admin_audit_logs** — id, actor_id, action, target_table, target_id text, metadata jsonb, created_at.
Solo inserción vía `log_admin_action()`; lectura admin.
**error_reports** — id, user_id null, message, route, digest, user_agent, status
(new|triaged|resolved), created_at. Inserta cualquiera autenticado (y anon con rate limit);
lee staff.
**rate_limits** — key text pk, window_start timestamptz, count int. Solo funciones.

## Funciones
- `has_role(role app_role) → boolean` (jerarquía superadmin ⊃ admin ⊃ editor).
- `is_premium(uid uuid default auth.uid()) → boolean` (suscripción trialing/active vigente).
- `consume_ai_quota(kind ai_request_kind) → jsonb {allowed, used, limit, plan, request_id}` atómica por
  usuario y mes. Si hay cupo **crea** la fila `pending` y devuelve su `request_id`.
- `complete_ai_request(request_id, status, provider?, model?, output?, error_code?, tokens_input?,
  tokens_output?, estimated_cost_usd?, latency_ms?, input_storage_path?) → boolean` (ver Notas).
- `check_rate_limit(bucket text, max_hits int, window_seconds int) → boolean`.
- `log_admin_action(action, target_table, target_id, metadata) → void`.
- `admin_metrics() → jsonb` agregados sin PII (requiere admin o service role; forma en Notas).
- `get_shared_plan(token text) → jsonb`.
- `search_foods(query text, max_results int default 20) → setof foods` (unaccent + trigram, públicos
  y propios).
- `has_professional_access(target_user uuid, require_write boolean default false) → boolean`.
- `register_push_subscription(sub_endpoint, sub_p256dh, sub_auth) → uuid`.
- `normalize_text(text) → text` (sin tildes, minúsculas, espacios colapsados).
- Triggers `set_updated_at`, `handle_new_user`.

## Storage
Buckets privados `progress-photos`, `meal-photos` (ruta `{user_id}/…`, solo el dueño; se leen con
URL firmada). Bucket público `recipe-images` (escritura staff o dueño en `{user_id}/…`).

## Notas de implementación (migraciones `20261013000001…012`)
Cambios y precisiones respecto al contrato original, con su motivo. Las migraciones mandan.

**Cambios al contrato**
- **`foods.barcode`**: en vez de `unique` global hay dos índices únicos parciales:
  `(barcode) where is_public` y `(created_by, barcode) where not is_public`. Motivo: con un único
  global, un alimento propio con código X bloqueaba cargar después el público con ese código y
  revelaba a otros usuarios qué códigos existen. Para upserts del catálogo usa
  `on conflict (barcode) where is_public and barcode is not null do …`.
  El código debe cumplir `^[0-9]{6,14}$`.
- **`app_settings.is_public`** (nuevo, default true): define qué claves lee anon/authenticated.
- **Flujo de IA**: `consume_ai_quota` crea la fila `pending` (o una `rejected_quota` con
  `error_code='quota_exceeded'`, que no cuenta) y devuelve `request_id`. El usuario **no** puede
  escribir `ai_analysis_requests` (si pudiera, se liberaría cupo a sí mismo); el servidor cierra la
  solicitud con `complete_ai_request(request_id, 'succeeded'|'failed'|'not_configured', …)`, que solo
  pasa `pending` → final una vez y solo para el dueño. **Si devuelve false, no entregues el
  resultado.** El mes se cuenta en la zona horaria del perfil. Una clave ausente en
  `plans.ai_monthly_limits` vale 0 (hoy `plan` no tiene cupo en ningún plan).
- **Profesionales** también leen `profiles` y `nutrition_targets` del usuario con acceso vigente
  (necesarios para proponer metas), además de `meal_logs`, `meal_log_items`, `weight_logs` y
  `user_goals`. `professional_access` solo acepta cuentas con rol `professional` (trigger) y
  `scope` ∈ (`read_logs`, `read_logs_write_targets`); escribir metas exige el segundo.
- **`push_subscriptions.endpoint`** sigue siendo único global; para que el mismo navegador pase de una
  cuenta a otra, registra con `register_push_subscription()` (reasigna el endpoint al usuario actual).

**Precisiones**
- `foods.name_normalized`, `foods.search` y `brands.name_normalized` los mantiene un trigger (no
  hace falta enviarlos; si se envían, se sobrescriben). `search` no es columna generada porque incluye
  el nombre de la marca (otra tabla).
- Alimento propio: `created_by = auth.uid()`, `is_public = false`, `verification_status =
  'unverified'`, `source` ∈ (`user`, `open_food_facts`, `usda`). `curated`/`admin`, verificar y
  publicar es solo staff.
- Recetas: el dueño solo guarda `status` `draft` o `pending_review` (si edita una publicada debe
  devolverla a `pending_review`); `reviewed_by/at` los fija solo el staff (trigger). Una receta
  `published` + `is_public` solo puede usar alimentos públicos (trigger, error 23514).
  `recipe_nutrition` además expone `ingredients_count`, `total_grams`, `per_serving_grams` y
  `fiber_incomplete` (algún ingrediente sin fibra → el total es un mínimo).
- `daily_nutrition_totals` solo lista días con al menos un ítem.
- `consents` es historial: solo SELECT e INSERT (revocar = nueva fila con `granted=false`).
- `subscriptions`/`payments`: el dueño y los admin leen; INSERT/UPDATE/DELETE revocados para
  anon/authenticated (solo service role). `billing_events`, `rate_limits`: sin acceso desde la API.
  Admin también lee `profiles`.
- `error_reports`: límite de 20/h por IP (anon) y 60/h por usuario; al pasarlo responde HTTP 429
  (SQLSTATE `PT429`). El service role no tiene límite.
- `check_rate_limit`: la clave es `bucket + usuario`; para anon `bucket + IP` (x-forwarded-for);
  con service role la clave es `bucket` tal cual (arma tú `'signup:ip:1.2.3.4'`).
- `is_premium(uid)`: un usuario solo puede consultarse a sí mismo (admin y service role, a
  cualquiera). Vigente = status trialing/active y fin de prueba/periodo en el futuro (o sin fecha).
- `admin_metrics()` devuelve: `generated_at`, `timezone` ('America/Lima'), `month_start`,
  `users_total`, `users_new_7d`, `users_new_30d`, `users_active_7d`, `users_active_30d` (registró
  comida), `premium_active` (trialing+active vigentes), `premium_trialing`, `premium_paying`,
  `conversion_rate` (= premium_paying / users_total, 4 decimales), `revenue_month_cents`
  (`{"PEN": n, …}` de pagos `succeeded` del mes), `cancellations_month`, `ai_requests_month`
  (pending+succeeded+failed), `ai_requests_by_kind`, `ai_requests_by_status`, `ai_cost_usd_month`.
- `get_shared_plan(token)` devuelve `{name, start_date, days, shared_at, items:[{day_index,
  meal_type, position, recipe:{title, slug|null}|null, food:{name}|null, servings, grams,
  energy_kcal, protein_g, carbs_g, fat_g}]}` o null; nunca `user_id` ni ids.
- Al borrar una cuenta (trigger en `auth.users`) se borran sus recetas y sus alimentos propios no
  usados en recetas ajenas; los públicos que creó quedan con `created_by = null`. **Los archivos de
  Storage no se borran solos**: el flujo de eliminación de cuenta debe vaciar `{user_id}/` en los
  buckets con la API de Storage.
- `profiles.timezone` se valida contra las zonas de Postgres (error 22023 si no existe).
- Tablas sin marcas de tiempo en este documento llevan `created_at`/`updated_at` (regla general).
  Se agregaron checks de rango razonables (p. ej. `weekly_rate_kg` 0–2, `nutrition_targets.energy_kcal`
  500–10000, `meal_type='custom'` exige `custom_name`, ayuno no activo exige `ended_at`).
- Storage: `recipe-images` (público, 10 MB, `image/*`) lo escribe el staff en cualquier ruta o el
  usuario en `{user_id}/…`. `progress-photos` y `meal-photos`: 10 MB, `image/*`, solo el dueño.
- Seeds: `supabase/seed/00_base.sql` (config: `./seed/*.sql`). Precios de Premium iniciales y
  editables: PEN 2990/19990, USD 799/5499 céntimos, 7 días de prueba.
