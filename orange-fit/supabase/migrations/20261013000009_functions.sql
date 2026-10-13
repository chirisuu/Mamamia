-- ORANGE FIT · 009 · Funciones de negocio (RPC) y triggers de integridad.
-- Todas las security definer llevan search_path = '' y nombres calificados.
-- Los permisos de ejecución se ajustan en 012.

-- Rol del JWT de la request ('anon' | 'authenticated' | 'service_role' | null fuera de la API).
create or replace function public.request_role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;

-- ---------------------------------------------------------------------------
-- is_premium: suscripción trialing/active vigente
-- ---------------------------------------------------------------------------
create or replace function public.is_premium(uid uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller uuid := (select auth.uid());
begin
  if uid is null then
    return false;
  end if;
  -- Un usuario solo puede consultar su propio plan (los admins y el service role, cualquiera).
  if v_caller is not null and uid <> v_caller and not public.has_role('admin') then
    raise exception 'No puedes consultar el plan de otra persona.' using errcode = '42501';
  end if;

  return exists (
    select 1
    from public.subscriptions s
    where s.user_id = is_premium.uid
      and s.status in ('trialing', 'active')
      -- Vigente: el fin de prueba (trialing) o de periodo (active) está en el futuro; sin fecha = vigente.
      and coalesce(
        case when s.status = 'trialing' then coalesce(s.trial_end, s.current_period_end)
             else s.current_period_end end,
        'infinity'::timestamptz
      ) > now()
  );
end;
$$;

comment on function public.is_premium(uuid) is
  'true si el usuario tiene una suscripción trialing/active vigente (fin de periodo o de prueba en el futuro, o sin fin).';

-- ---------------------------------------------------------------------------
-- consume_ai_quota: reserva atómica de un uso de IA del mes en curso
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_quota(kind public.ai_request_kind)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_plan text;
  v_limits jsonb;
  v_limit integer := 0;
  v_used integer;
  v_tz text;
  v_month_start timestamptz;
  v_request_id uuid;
  v_allowed boolean;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión para usar la IA.' using errcode = '42501';
  end if;

  -- Serializa las llamadas del mismo usuario (dos pestañas no pueden pasarse del límite a la vez).
  perform pg_advisory_xact_lock(hashtextextended('consume_ai_quota:' || v_uid::text, 0));

  v_plan := case when public.is_premium(v_uid) then 'premium' else 'free' end;

  select p.ai_monthly_limits into v_limits
  from public.plans p
  where p.id = v_plan and p.is_active;

  if v_limits is not null and jsonb_typeof(v_limits -> (consume_ai_quota.kind)::text) = 'number' then
    v_limit := greatest(floor((v_limits ->> (consume_ai_quota.kind)::text)::numeric)::integer, 0);
  end if;

  -- El mes se cuenta en la zona horaria del usuario.
  select pr.timezone into v_tz from public.profiles pr where pr.id = v_uid;
  v_tz := coalesce(v_tz, 'America/Lima');
  v_month_start := date_trunc('month', now() at time zone v_tz) at time zone v_tz;

  select count(*)::integer into v_used
  from public.ai_analysis_requests r
  where r.user_id = v_uid
    and r.kind = consume_ai_quota.kind
    and r.status in ('pending', 'succeeded')
    and r.created_at >= v_month_start;

  v_allowed := v_used < v_limit;

  if v_allowed then
    insert into public.ai_analysis_requests (user_id, kind, status)
    values (v_uid, consume_ai_quota.kind, 'pending')
    returning id into v_request_id;
    v_used := v_used + 1;
  else
    -- Se registra el rechazo (sirve para métricas); no cuenta como uso.
    insert into public.ai_analysis_requests (user_id, kind, status, error_code)
    values (v_uid, consume_ai_quota.kind, 'rejected_quota', 'quota_exceeded');
  end if;

  return jsonb_build_object(
    'allowed', v_allowed,
    'used', v_used,
    'limit', v_limit,
    'plan', v_plan,
    'request_id', v_request_id
  );
end;
$$;

comment on function public.consume_ai_quota(public.ai_request_kind) is
  'Atómica por usuario (advisory lock). Cuenta pending+succeeded del mes (zona del perfil) contra plans.ai_monthly_limits. '
  'Si hay cupo crea la fila pending y devuelve su request_id. Devuelve {allowed, used, limit, plan, request_id}.';

-- ---------------------------------------------------------------------------
-- complete_ai_request: cierra una solicitud pending del usuario actual
-- ---------------------------------------------------------------------------
create or replace function public.complete_ai_request(
  request_id uuid,
  status public.ai_request_status,
  provider text default null,
  model text default null,
  output jsonb default null,
  error_code text default null,
  tokens_input integer default null,
  tokens_output integer default null,
  estimated_cost_usd numeric default null,
  latency_ms integer default null,
  input_storage_path text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if complete_ai_request.status not in ('succeeded', 'failed', 'not_configured') then
    raise exception 'Estado final inválido: %', complete_ai_request.status using errcode = '22023';
  end if;

  update public.ai_analysis_requests r
  set status = complete_ai_request.status,
      provider = coalesce(complete_ai_request.provider, r.provider),
      model = coalesce(complete_ai_request.model, r.model),
      output = coalesce(complete_ai_request.output, r.output),
      error_code = coalesce(complete_ai_request.error_code, r.error_code),
      tokens_input = coalesce(complete_ai_request.tokens_input, r.tokens_input),
      tokens_output = coalesce(complete_ai_request.tokens_output, r.tokens_output),
      estimated_cost_usd = coalesce(complete_ai_request.estimated_cost_usd, r.estimated_cost_usd),
      latency_ms = coalesce(complete_ai_request.latency_ms, r.latency_ms),
      input_storage_path = coalesce(complete_ai_request.input_storage_path, r.input_storage_path)
  where r.id = complete_ai_request.request_id
    and r.user_id = v_uid
    and r.status = 'pending';

  get diagnostics v_updated = row_count;
  -- false: no existe, no es tuya o ya estaba cerrada. En ese caso no entregues el resultado.
  return v_updated = 1;
end;
$$;

comment on function public.complete_ai_request(uuid, public.ai_request_status, text, text, jsonb, text, integer, integer, numeric, integer, text) is
  'Pasa una solicitud propia de pending a succeeded/failed/not_configured (una sola vez). Devuelve false si no pudo.';

-- ---------------------------------------------------------------------------
-- check_rate_limit: ventana fija por (bucket, usuario | IP)
-- ---------------------------------------------------------------------------
create or replace function public.check_rate_limit(bucket text, max_hits integer, window_seconds integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_key text;
  v_ip text;
  v_headers text;
  v_window interval;
  v_count integer;
begin
  if bucket is null or char_length(bucket) not between 1 and 200 then
    raise exception 'bucket inválido' using errcode = '22023';
  end if;
  if max_hits is null or max_hits < 1 or window_seconds is null or window_seconds not between 1 and 2678400 then
    raise exception 'Parámetros de rate limit inválidos' using errcode = '22023';
  end if;
  v_window := make_interval(secs => window_seconds);

  if v_uid is not null then
    v_key := bucket || ':u:' || v_uid::text;
  elsif public.request_role() = 'service_role' then
    -- El servidor arma la clave completa (p. ej. 'signup:ip:1.2.3.4').
    v_key := bucket;
  else
    v_headers := nullif(current_setting('request.headers', true), '');
    if v_headers is not null then
      v_ip := nullif(btrim(split_part(v_headers::jsonb ->> 'x-forwarded-for', ',', 1)), '');
    end if;
    v_key := bucket || ':ip:' || coalesce(v_ip, 'unknown');
  end if;

  insert into public.rate_limits as rl (key, window_start, count)
  values (v_key, now(), 1)
  on conflict (key) do update
    set window_start = case when rl.window_start <= now() - v_window then now() else rl.window_start end,
        count = case when rl.window_start <= now() - v_window then 1 else rl.count + 1 end
  returning rl.count into v_count;

  return v_count <= max_hits;
end;
$$;

comment on function public.check_rate_limit(text, integer, integer) is
  'true mientras no se pase max_hits en la ventana. Clave = bucket + usuario (o IP si es anon; el service role pasa la clave completa).';

-- ---------------------------------------------------------------------------
-- log_admin_action: única vía de escritura en admin_audit_logs
-- ---------------------------------------------------------------------------
create or replace function public.log_admin_action(
  action text,
  target_table text default null,
  target_id text default null,
  metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (public.has_role('editor') or public.request_role() = 'service_role') then
    raise exception 'Solo el personal autorizado puede registrar acciones.' using errcode = '42501';
  end if;
  insert into public.admin_audit_logs (actor_id, action, target_table, target_id, metadata)
  values (
    (select auth.uid()),
    log_admin_action.action,
    log_admin_action.target_table,
    log_admin_action.target_id,
    coalesce(log_admin_action.metadata, '{}'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_metrics: agregados sin PII (requiere admin o service role)
-- ---------------------------------------------------------------------------
create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- Los meses del negocio se cuentan en hora de Lima.
  v_tz constant text := 'America/Lima';
  v_month_start timestamptz := date_trunc('month', now() at time zone v_tz) at time zone v_tz;
  v_users_total bigint;
  v_new_7d bigint;
  v_new_30d bigint;
  v_active_7d bigint;
  v_active_30d bigint;
  v_premium_active bigint;
  v_premium_trialing bigint;
  v_premium_paying bigint;
  v_cancellations bigint;
  v_revenue jsonb;
  v_ai_requests bigint;
  v_ai_by_kind jsonb;
  v_ai_by_status jsonb;
  v_ai_cost numeric;
begin
  if not (public.has_role('admin') or public.request_role() = 'service_role') then
    raise exception 'Solo administradores.' using errcode = '42501';
  end if;

  select count(*),
         count(*) filter (where u.created_at >= now() - interval '7 days'),
         count(*) filter (where u.created_at >= now() - interval '30 days')
    into v_users_total, v_new_7d, v_new_30d
  from auth.users u
  where u.deleted_at is null;

  -- Activo = registró comida (meal_logs o sus ítems) en la ventana.
  with activity as (
    select ml.user_id, ml.created_at from public.meal_logs ml where ml.created_at >= now() - interval '30 days'
    union all
    select mli.user_id, mli.created_at from public.meal_log_items mli where mli.created_at >= now() - interval '30 days'
  )
  select count(distinct a.user_id) filter (where a.created_at >= now() - interval '7 days'),
         count(distinct a.user_id)
    into v_active_7d, v_active_30d
  from activity a;

  with valid as (
    select s.user_id, s.status
    from public.subscriptions s
    where s.status in ('trialing', 'active')
      and coalesce(
        case when s.status = 'trialing' then coalesce(s.trial_end, s.current_period_end)
             else s.current_period_end end,
        'infinity'::timestamptz
      ) > now()
  )
  select count(distinct v.user_id),
         count(distinct v.user_id) filter (where v.status = 'trialing'),
         count(distinct v.user_id) filter (where v.status = 'active')
    into v_premium_active, v_premium_trialing, v_premium_paying
  from valid v;

  select count(*) into v_cancellations
  from public.subscriptions s
  where s.canceled_at >= v_month_start;

  select coalesce(jsonb_object_agg(t.currency_code, t.total_cents), '{}'::jsonb) into v_revenue
  from (
    select p.currency_code::text as currency_code, sum(p.amount_cents)::bigint as total_cents
    from public.payments p
    where p.status = 'succeeded' and p.paid_at >= v_month_start
    group by p.currency_code
  ) t;

  select count(*), coalesce(sum(r.estimated_cost_usd), 0)
    into v_ai_requests, v_ai_cost
  from public.ai_analysis_requests r
  where r.created_at >= v_month_start and r.status in ('pending', 'succeeded', 'failed');

  select coalesce(jsonb_object_agg(t.kind, t.n), '{}'::jsonb) into v_ai_by_kind
  from (
    select r.kind::text as kind, count(*) as n
    from public.ai_analysis_requests r
    where r.created_at >= v_month_start and r.status in ('pending', 'succeeded', 'failed')
    group by r.kind
  ) t;

  select coalesce(jsonb_object_agg(t.status, t.n), '{}'::jsonb) into v_ai_by_status
  from (
    select r.status::text as status, count(*) as n
    from public.ai_analysis_requests r
    where r.created_at >= v_month_start
    group by r.status
  ) t;

  return jsonb_build_object(
    'generated_at', now(),
    'timezone', v_tz,
    'month_start', v_month_start,
    'users_total', v_users_total,
    'users_new_7d', v_new_7d,
    'users_new_30d', v_new_30d,
    'users_active_7d', v_active_7d,
    'users_active_30d', v_active_30d,
    'premium_active', v_premium_active,
    'premium_trialing', v_premium_trialing,
    'premium_paying', v_premium_paying,
    'conversion_rate', case when v_users_total > 0
                            then round(v_premium_paying::numeric / v_users_total, 4) else 0 end,
    'revenue_month_cents', v_revenue,
    'cancellations_month', v_cancellations,
    'ai_requests_month', v_ai_requests,
    'ai_requests_by_kind', v_ai_by_kind,
    'ai_requests_by_status', v_ai_by_status,
    'ai_cost_usd_month', round(v_ai_cost, 4)
  );
end;
$$;

comment on function public.admin_metrics() is
  'Agregados sin PII para el panel admin. Ver forma exacta en docs/DATA_MODEL.md.';

-- ---------------------------------------------------------------------------
-- get_shared_plan: lectura pública de un plan compartido por token
-- ---------------------------------------------------------------------------
create or replace function public.get_shared_plan(token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', mp.name,
    'start_date', mp.start_date,
    'days', mp.days,
    'shared_at', mp.shared_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
          'day_index', i.day_index,
          'meal_type', i.meal_type,
          'position', i.position,
          'recipe', case when r.id is null then null else jsonb_build_object(
            'title', r.title,
            -- El slug solo se expone si la receta es pública y publicada (para enlazarla).
            'slug', case when r.status = 'published' and r.is_public then r.slug end
          ) end,
          'food', case when f.id is null then null else jsonb_build_object('name', f.name) end,
          'servings', i.servings,
          'grams', i.grams,
          'energy_kcal', i.energy_kcal,
          'protein_g', i.protein_g,
          'carbs_g', i.carbs_g,
          'fat_g', i.fat_g
        ) order by i.day_index, i.meal_type, i.position)
      from public.meal_plan_items i
      left join public.recipes r on r.id = i.recipe_id
      left join public.foods f on f.id = i.food_id
      where i.plan_id = mp.id
    ), '[]'::jsonb)
  )
  from public.meal_plans mp
  where get_shared_plan.token is not null
    and char_length(get_shared_plan.token) >= 16
    and mp.share_token = get_shared_plan.token;
$$;

comment on function public.get_shared_plan(text) is
  'Plan compartido (sin user_id ni ids internos) o null si el token no existe.';

-- ---------------------------------------------------------------------------
-- search_foods: búsqueda sin tildes + trigramas, públicos y propios
-- ---------------------------------------------------------------------------
create or replace function public.search_foods(query text, max_results integer default 20)
returns setof public.foods
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select public.normalize_text(search_foods.query) as term
  ),
  p as (
    select q.term,
           -- Escapa comodines de LIKE que vengan en la consulta.
           replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') as like_term
    from q
  )
  select f.*
  from public.foods f, p
  where char_length(p.term) >= 2
    and (f.is_public or f.created_by = (select auth.uid()))
    and f.verification_status <> 'rejected'
    and (
      f.name_normalized like '%' || p.like_term || '%'
      or p.term operator(extensions.<%) f.name_normalized
      or f.search @@ plainto_tsquery('simple'::regconfig, p.term)
    )
  order by
    greatest(
      extensions.similarity(p.term, f.name_normalized),
      extensions.word_similarity(p.term, f.name_normalized)
    ) desc,
    (f.name_normalized like p.like_term || '%') desc,
    (f.verification_status in ('verified', 'curated')) desc,
    char_length(f.name_normalized),
    f.name
  limit least(greatest(coalesce(search_foods.max_results, 20), 1), 100);
$$;

comment on function public.search_foods(text, integer) is
  'Busca por nombre/marca sin tildes (unaccent + pg_trgm). Devuelve públicos + propios, ordenados por similitud.';

-- ---------------------------------------------------------------------------
-- register_push_subscription: el mismo navegador puede pasar de una cuenta a otra
-- ---------------------------------------------------------------------------
create or replace function public.register_push_subscription(sub_endpoint text, sub_p256dh text, sub_auth text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '42501';
  end if;
  if sub_endpoint is null or sub_endpoint !~ '^https://' or char_length(sub_endpoint) > 2000 then
    raise exception 'Endpoint de notificaciones inválido.' using errcode = '22023';
  end if;
  insert into public.push_subscriptions as ps (user_id, endpoint, p256dh, auth)
  values (v_uid, sub_endpoint, sub_p256dh, sub_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
  returning ps.id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers de integridad
-- ---------------------------------------------------------------------------

-- Una receta pública y publicada solo puede usar alimentos públicos (si no, otros no verían sus nutrientes).
create or replace function public.enforce_public_recipe_foods()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'recipes' then
    if new.status = 'published' and new.is_public and exists (
      select 1
      from public.recipe_ingredients ri
      join public.foods f on f.id = ri.food_id
      where ri.recipe_id = new.id and not f.is_public
    ) then
      raise exception 'Una receta pública solo puede usar alimentos públicos.' using errcode = '23514';
    end if;
  elsif exists (
      select 1 from public.recipes r
      where r.id = new.recipe_id and r.status = 'published' and r.is_public
    ) and exists (
      select 1 from public.foods f where f.id = new.food_id and not f.is_public
    ) then
    raise exception 'Una receta pública solo puede usar alimentos públicos.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recipes_enforce_public_foods
  before insert or update of status, is_public on public.recipes
  for each row execute function public.enforce_public_recipe_foods();

create trigger recipe_ingredients_enforce_public_foods
  before insert or update of food_id, recipe_id on public.recipe_ingredients
  for each row execute function public.enforce_public_recipe_foods();

-- Solo el staff fija los campos de revisión de una receta.
create or replace function public.guard_recipe_review_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.has_role('editor') then
    return new; -- service role, seeds o staff
  end if;
  if tg_op = 'INSERT' then
    new.reviewed_by := null;
    new.reviewed_at := null;
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;
  return new;
end;
$$;

create trigger recipes_guard_review_fields
  before insert or update on public.recipes
  for each row execute function public.guard_recipe_review_fields();

-- Reportes de error: límite por usuario o IP (el service role no tiene límite).
create or replace function public.enforce_error_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sin JWT (seeds, mantenimiento directo en la base) o service role: sin límite.
  if public.request_role() is null or public.request_role() = 'service_role' then
    return new;
  end if;
  if not public.check_rate_limit(
    'error_reports',
    case when (select auth.uid()) is null then 20 else 60 end,
    3600
  ) then
    -- PT429 → PostgREST responde HTTP 429.
    raise exception 'Demasiados reportes de error. Intenta más tarde.' using errcode = 'PT429';
  end if;
  return new;
end;
$$;

create trigger error_reports_rate_limit
  before insert on public.error_reports
  for each row execute function public.enforce_error_report_rate_limit();

-- Al borrar una cuenta: sus recetas y alimentos propios se van con ella. Los públicos que haya
-- creado (staff) quedan con created_by = null.
create or replace function public.handle_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.recipes r where r.owner_id = old.id;
  delete from public.foods f
  where f.created_by = old.id
    and not f.is_public
    and not exists (select 1 from public.recipe_ingredients ri where ri.food_id = f.id);
  return old;
end;
$$;

create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.handle_deleted_user();
