-- ORANGE FIT · admin · Funciones y ajustes aditivos para el panel de administración.
--
-- 1. admin_ai_usage(months): agregados de ai_analysis_requests por mes, tipo, modelo y estado
--    (sin user_id ni contenido). ai_analysis_requests solo es legible por su dueño (RLS), así que
--    el panel necesita esta función security definer limitada a admin.
-- 2. admin_merge_foods(keep_id, drop_id): fusiona un duplicado del catálogo público en una sola
--    transacción. user_favorites, meal_template_items, meal_plan_items y shopping_list_items son
--    "solo del dueño" por RLS: el staff no podría reapuntarlos sin esta función.
-- 3. recipes.review_note + aviso al autor cuando el staff publica o rechaza su receta (el staff no
--    puede insertar notificaciones ajenas por RLS; mismo patrón que notify_professional_target).

-- ---------------------------------------------------------------------------
-- 1. Uso de IA agregado
-- ---------------------------------------------------------------------------
create or replace function public.admin_ai_usage(months integer default 6)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz constant text := 'America/Lima';
  v_months integer := least(greatest(coalesce(months, 6), 1), 24);
  v_from timestamptz := (date_trunc('month', now() at time zone v_tz) - make_interval(months => v_months - 1)) at time zone v_tz;
  v_rows jsonb;
  v_errors jsonb;
begin
  if not (public.has_role('admin') or coalesce(public.request_role(), '') = 'service_role') then
    raise exception 'Solo administradores.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'month', t.month,
           'kind', t.kind,
           'model', t.model,
           'status', t.status,
           'requests', t.n,
           'cost_usd', t.cost,
           'tokens_input', t.tin,
           'tokens_output', t.tout,
           'avg_latency_ms', t.lat
         ) order by t.month, t.kind, t.model nulls first, t.status), '[]'::jsonb)
    into v_rows
  from (
    select to_char(date_trunc('month', r.created_at at time zone v_tz), 'YYYY-MM') as month,
           r.kind::text as kind,
           nullif(btrim(r.model), '') as model,
           r.status::text as status,
           count(*)::bigint as n,
           round(coalesce(sum(r.estimated_cost_usd), 0), 6) as cost,
           coalesce(sum(r.tokens_input), 0)::bigint as tin,
           coalesce(sum(r.tokens_output), 0)::bigint as tout,
           round(avg(r.latency_ms))::integer as lat
    from public.ai_analysis_requests r
    where r.created_at >= v_from
    group by 1, 2, 3, 4
  ) t;

  -- Solo códigos de error (texto controlado por el servidor), nunca mensajes ni salidas.
  select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'error_code', e.code, 'requests', e.n)
                            order by e.n desc, e.code), '[]'::jsonb)
    into v_errors
  from (
    select r.status::text as status, coalesce(nullif(btrim(r.error_code), ''), 'sin_codigo') as code, count(*)::bigint as n
    from public.ai_analysis_requests r
    where r.created_at >= v_from and r.status in ('failed', 'not_configured', 'rejected_quota')
    group by 1, 2
    order by 3 desc
    limit 30
  ) e;

  return jsonb_build_object(
    'generated_at', now(),
    'timezone', v_tz,
    'from', v_from,
    'months', v_months,
    'rows', v_rows,
    'errors', v_errors
  );
end;
$$;

comment on function public.admin_ai_usage(integer) is
  'Uso de IA agregado por mes (hora de Lima), tipo, modelo y estado. Sin usuarios ni contenido. Solo admin o service role.';

-- ---------------------------------------------------------------------------
-- 2. Fusión de alimentos duplicados
-- ---------------------------------------------------------------------------
create or replace function public.admin_merge_foods(keep_id uuid, drop_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_keep public.foods%rowtype;
  v_drop public.foods%rowtype;
  v_ingredients integer;
  v_favorites integer;
  v_favorites_removed integer;
  v_templates integer;
  v_plan_items integer;
  v_shopping integer;
  v_prices integer;
  v_barcode_moved boolean := false;
begin
  if not (public.has_role('editor') or coalesce(public.request_role(), '') = 'service_role') then
    raise exception 'Solo el personal autorizado puede fusionar alimentos.' using errcode = '42501';
  end if;
  if keep_id is null or drop_id is null or keep_id = drop_id then
    raise exception 'Elige dos alimentos distintos.' using errcode = '22023';
  end if;

  -- Bloqueo en orden fijo para evitar interbloqueos entre dos fusiones simultáneas.
  perform 1 from public.foods f where f.id in (keep_id, drop_id) order by f.id for update;

  select * into v_keep from public.foods f where f.id = keep_id;
  select * into v_drop from public.foods f where f.id = drop_id;
  if v_keep.id is null or v_drop.id is null then
    raise exception 'Alguno de los alimentos ya no existe.' using errcode = 'P0002';
  end if;
  if not v_keep.is_public or v_keep.verification_status = 'rejected' then
    raise exception 'El alimento que se conserva debe ser público y no estar rechazado.' using errcode = '22023';
  end if;
  if not v_drop.is_public then
    raise exception 'El duplicado ya no está publicado.' using errcode = '22023';
  end if;

  update public.recipe_ingredients set food_id = keep_id where food_id = drop_id;
  get diagnostics v_ingredients = row_count;

  -- Quien tenía ambos como favoritos conserva uno solo (índice único por usuario y alimento).
  delete from public.user_favorites uf
  where uf.food_id = drop_id
    and exists (select 1 from public.user_favorites k where k.user_id = uf.user_id and k.food_id = keep_id);
  get diagnostics v_favorites_removed = row_count;
  update public.user_favorites set food_id = keep_id where food_id = drop_id;
  get diagnostics v_favorites = row_count;

  update public.meal_template_items set food_id = keep_id where food_id = drop_id;
  get diagnostics v_templates = row_count;
  update public.meal_plan_items set food_id = keep_id where food_id = drop_id;
  get diagnostics v_plan_items = row_count;
  update public.shopping_list_items set food_id = keep_id where food_id = drop_id;
  get diagnostics v_shopping = row_count;
  update public.reference_prices set food_id = keep_id where food_id = drop_id;
  get diagnostics v_prices = row_count;
  -- meal_log_items no se toca: el diario guarda copia de los nutrientes y es historial.

  -- Se despublica el duplicado y queda sin dueño (no debe aparecer como "alimento propio" de nadie).
  update public.foods
  set is_public = false,
      barcode = null,
      created_by = null,
      verification_status = 'rejected',
      verified_by = (select auth.uid()),
      verified_at = now()
  where id = drop_id;

  -- Si solo el duplicado tenía código de barras, pasa al conservado (sigue encontrándose al escanear).
  if v_keep.barcode is null and v_drop.barcode is not null then
    update public.foods set barcode = v_drop.barcode where id = keep_id;
    v_barcode_moved := true;
  end if;

  return jsonb_build_object(
    'keep_id', keep_id,
    'drop_id', drop_id,
    'recipe_ingredients', v_ingredients,
    'favorites', v_favorites,
    'favorites_removed', v_favorites_removed,
    'template_items', v_templates,
    'plan_items', v_plan_items,
    'shopping_items', v_shopping,
    'reference_prices', v_prices,
    'barcode_moved', v_barcode_moved
  );
end;
$$;

comment on function public.admin_merge_foods(uuid, uuid) is
  'Fusiona un alimento público duplicado en otro: reapunta ingredientes, favoritos, plantillas, planes, compras y precios, y despublica el duplicado (rejected). Solo staff.';

-- ---------------------------------------------------------------------------
-- 3. Motivo de revisión de recetas y aviso al autor
-- ---------------------------------------------------------------------------
alter table public.recipes
  add column if not exists review_note text check (review_note is null or char_length(review_note) <= 500);

comment on column public.recipes.review_note is
  'Motivo que deja el staff al rechazar (o nota al publicar). Lo ve el autor en su notificación.';

create or replace function public.notify_recipe_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null
     or new.status is not distinct from old.status
     or new.status not in ('published', 'rejected')
     or new.owner_id = (select auth.uid())
     or not (public.has_role('editor') or coalesce(public.request_role(), '') = 'service_role') then
    return new;
  end if;
  insert into public.notifications (user_id, type, title, body, url)
  values (
    new.owner_id,
    case when new.status = 'published' then 'recipe_published' else 'recipe_rejected' end,
    case when new.status = 'published' then 'Tu receta ya está publicada' else 'Tu receta no fue publicada' end,
    case
      when new.status = 'published' then format('«%s» ya aparece en el catálogo de recetas.', new.title)
      else format('«%s». Motivo: %s. Puedes editarla y volver a enviarla a revisión.', new.title,
                  coalesce(nullif(rtrim(btrim(new.review_note), '.'), ''), 'el equipo la revisó y no la publicó'))
    end,
    '/app/recetas/' || new.slug
  );
  return new;
end;
$$;

drop trigger if exists recipes_notify_review on public.recipes;
create trigger recipes_notify_review
  after update of status on public.recipes
  for each row execute function public.notify_recipe_review();

-- ---------------------------------------------------------------------------
-- Privilegios (mismo criterio que 20261013000012_grants.sql)
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_ai_usage(integer) from public, anon, authenticated;
revoke execute on function public.admin_merge_foods(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.notify_recipe_review() from public, anon, authenticated;
grant execute on function public.admin_ai_usage(integer) to authenticated, service_role;
grant execute on function public.admin_merge_foods(uuid, uuid) to authenticated, service_role;
