-- ORANGE FIT · 004 · Recetas, favoritos, plantillas, diario de comidas, planes y listas de compras.

-- ---------------------------------------------------------------------------
-- recipes
-- ---------------------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete cascade, -- null = receta oficial
  title text not null check (char_length(btrim(title)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 180),
  description text check (description is null or char_length(description) <= 4000),
  servings numeric(4,1) not null default 1 check (servings > 0),
  prep_minutes integer check (prep_minutes is null or prep_minutes between 0 and 1440),
  cook_minutes integer check (cook_minutes is null or cook_minutes between 0 and 1440),
  difficulty text check (difficulty is null or difficulty in ('easy', 'medium', 'hard')),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array'),
  image_path text,
  tags text[] not null default '{}',
  diet_tags text[] not null default '{}',
  allergens text[] not null default '{}',
  meal_types public.meal_type[] not null default '{}',
  country_code char(2) check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  estimated_cost numeric(10,2) check (estimated_cost is null or estimated_cost >= 0),
  cost_currency char(3) check (cost_currency is null or cost_currency ~ '^[A-Z]{3}$'),
  status public.recipe_status not null default 'draft',
  is_public boolean not null default false,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipes_owner_idx on public.recipes (owner_id) where owner_id is not null;
create index recipes_published_idx on public.recipes (status, is_public);
create index recipes_title_trgm_idx on public.recipes using gin (title extensions.gin_trgm_ops);

create trigger recipes_set_updated_at
  before update on public.recipes
  for each row execute function public.set_updated_at();

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  food_id uuid not null references public.foods (id),
  grams numeric not null check (grams > 0),
  display_quantity numeric check (display_quantity is null or display_quantity > 0),
  display_unit text,
  note text check (note is null or char_length(note) <= 300),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, position);
create index recipe_ingredients_food_idx on public.recipe_ingredients (food_id);

create trigger recipe_ingredients_set_updated_at
  before update on public.recipe_ingredients
  for each row execute function public.set_updated_at();

-- Nutrición de recetas calculada desde ingredientes × foods (por 100 g).
-- security_invoker: respeta el RLS de recipes, recipe_ingredients y foods.
create view public.recipe_nutrition
with (security_invoker = true)
as
select
  r.id as recipe_id,
  r.servings,
  count(ri.id)::integer as ingredients_count,
  coalesce(sum(ri.grams), 0)::numeric(10,2) as total_grams,
  coalesce(sum(ri.grams * f.energy_kcal / 100), 0)::numeric(10,2) as total_energy_kcal,
  coalesce(sum(ri.grams * f.protein_g / 100), 0)::numeric(10,2) as total_protein_g,
  coalesce(sum(ri.grams * f.carbs_g / 100), 0)::numeric(10,2) as total_carbs_g,
  coalesce(sum(ri.grams * f.fat_g / 100), 0)::numeric(10,2) as total_fat_g,
  coalesce(sum(ri.grams * coalesce(f.fiber_g, 0) / 100), 0)::numeric(10,2) as total_fiber_g,
  (coalesce(sum(ri.grams * f.energy_kcal / 100), 0) / r.servings)::numeric(10,2) as per_serving_energy_kcal,
  (coalesce(sum(ri.grams * f.protein_g / 100), 0) / r.servings)::numeric(10,2) as per_serving_protein_g,
  (coalesce(sum(ri.grams * f.carbs_g / 100), 0) / r.servings)::numeric(10,2) as per_serving_carbs_g,
  (coalesce(sum(ri.grams * f.fat_g / 100), 0) / r.servings)::numeric(10,2) as per_serving_fat_g,
  (coalesce(sum(ri.grams * coalesce(f.fiber_g, 0) / 100), 0) / r.servings)::numeric(10,2) as per_serving_fiber_g,
  (coalesce(sum(ri.grams), 0) / r.servings)::numeric(10,2) as per_serving_grams,
  -- true si algún ingrediente no tiene fibra registrada (el total de fibra es un mínimo).
  coalesce(bool_or(f.fiber_g is null), false) as fiber_incomplete
from public.recipes r
left join public.recipe_ingredients ri on ri.recipe_id = r.id
left join public.foods f on f.id = ri.food_id
group by r.id, r.servings;

comment on view public.recipe_nutrition is
  'Totales y por porción (kcal, proteína, carbos, grasa, fibra) desde ingredientes × foods. security_invoker.';

-- ---------------------------------------------------------------------------
-- user_favorites
-- ---------------------------------------------------------------------------
create table public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (num_nonnulls(food_id, recipe_id) = 1)
);

create unique index user_favorites_food_key on public.user_favorites (user_id, food_id) where food_id is not null;
create unique index user_favorites_recipe_key on public.user_favorites (user_id, recipe_id) where recipe_id is not null;
create index user_favorites_food_idx on public.user_favorites (food_id) where food_id is not null;
create index user_favorites_recipe_idx on public.user_favorites (recipe_id) where recipe_id is not null;

-- ---------------------------------------------------------------------------
-- meal_templates
-- ---------------------------------------------------------------------------
create table public.meal_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  meal_type public.meal_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_templates_user_idx on public.meal_templates (user_id);

create trigger meal_templates_set_updated_at
  before update on public.meal_templates
  for each row execute function public.set_updated_at();

create table public.meal_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.meal_templates (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete cascade,
  recipe_id uuid references public.recipes (id) on delete cascade,
  grams numeric check (grams is null or grams > 0),
  servings numeric check (servings is null or servings > 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(food_id, recipe_id) = 1),
  check (grams is not null or servings is not null)
);

create index meal_template_items_template_idx on public.meal_template_items (template_id, position);
create index meal_template_items_user_idx on public.meal_template_items (user_id);
create index meal_template_items_food_idx on public.meal_template_items (food_id) where food_id is not null;
create index meal_template_items_recipe_idx on public.meal_template_items (recipe_id) where recipe_id is not null;

create trigger meal_template_items_set_updated_at
  before update on public.meal_template_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- meal_logs / meal_log_items (diario)
-- ---------------------------------------------------------------------------
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  meal_type public.meal_type not null,
  custom_name text check (custom_name is null or char_length(btrim(custom_name)) between 1 and 60),
  created_at timestamptz not null default now(),
  check (meal_type <> 'custom' or custom_name is not null)
);

-- Una comida por tipo y día (las "custom" se distinguen por nombre). Sirve también de índice user_id+local_date.
create unique index meal_logs_unique_meal
  on public.meal_logs (user_id, local_date, meal_type, coalesce(custom_name, ''));
create index meal_logs_created_idx on public.meal_logs (created_at);

create table public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  meal_log_id uuid not null references public.meal_logs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand_name text,
  quantity numeric not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 30),
  grams numeric check (grams is null or grams > 0),
  -- Copia de los nutrientes al momento de registrar.
  energy_kcal numeric(8,2) not null check (energy_kcal >= 0),
  protein_g numeric(7,2) not null check (protein_g >= 0),
  carbs_g numeric(7,2) not null check (carbs_g >= 0),
  fat_g numeric(7,2) not null check (fat_g >= 0),
  fiber_g numeric(7,2) check (fiber_g is null or fiber_g >= 0),
  sugar_g numeric(7,2) check (sugar_g is null or sugar_g >= 0),
  sodium_mg numeric(9,2) check (sodium_mg is null or sodium_mg >= 0),
  micronutrients jsonb not null default '{}'::jsonb check (jsonb_typeof(micronutrients) = 'object'),
  source public.log_source not null default 'manual',
  data_provenance text,
  ai_request_id uuid, -- FK a ai_analysis_requests en 006
  confidence numeric(3,2) check (confidence is null or confidence between 0 and 1),
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_log_items_meal_log_idx on public.meal_log_items (meal_log_id);
create index meal_log_items_user_created_idx on public.meal_log_items (user_id, created_at desc);
create index meal_log_items_food_idx on public.meal_log_items (food_id) where food_id is not null;
create index meal_log_items_recipe_idx on public.meal_log_items (recipe_id) where recipe_id is not null;
create index meal_log_items_created_idx on public.meal_log_items (created_at);

create trigger meal_log_items_set_updated_at
  before update on public.meal_log_items
  for each row execute function public.set_updated_at();

-- Totales por día. security_invoker: cada quien ve solo lo que el RLS de meal_logs/meal_log_items le permite.
create view public.daily_nutrition_totals
with (security_invoker = true)
as
select
  ml.user_id,
  ml.local_date,
  coalesce(sum(mli.energy_kcal), 0)::numeric(10,2) as energy_kcal,
  coalesce(sum(mli.protein_g), 0)::numeric(10,2) as protein_g,
  coalesce(sum(mli.carbs_g), 0)::numeric(10,2) as carbs_g,
  coalesce(sum(mli.fat_g), 0)::numeric(10,2) as fat_g,
  coalesce(sum(mli.fiber_g), 0)::numeric(10,2) as fiber_g,
  coalesce(sum(mli.sugar_g), 0)::numeric(10,2) as sugar_g,
  coalesce(sum(mli.sodium_mg), 0)::numeric(12,2) as sodium_mg,
  count(mli.id)::integer as items_count
from public.meal_logs ml
join public.meal_log_items mli on mli.meal_log_id = ml.id
group by ml.user_id, ml.local_date;

comment on view public.daily_nutrition_totals is
  'Suma diaria de meal_log_items por user_id y local_date. security_invoker.';

-- ---------------------------------------------------------------------------
-- meal_plans / meal_plan_items
-- ---------------------------------------------------------------------------
create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  start_date date not null,
  days smallint not null check (days between 1 and 14),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  generator text not null default 'engine' check (generator in ('engine', 'manual')),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  share_token text unique check (share_token is null or char_length(share_token) between 16 and 128),
  shared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plans_user_start_idx on public.meal_plans (user_id, start_date desc);

create trigger meal_plans_set_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_index smallint not null check (day_index between 0 and 13),
  meal_type public.meal_type not null,
  recipe_id uuid references public.recipes (id) on delete set null,
  food_id uuid references public.foods (id) on delete set null,
  servings numeric check (servings is null or servings > 0),
  grams numeric check (grams is null or grams > 0),
  -- Copia de los nutrientes al momento de planificar.
  energy_kcal numeric(8,2) not null default 0 check (energy_kcal >= 0),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_plan_items_plan_idx on public.meal_plan_items (plan_id, day_index, position);
create index meal_plan_items_user_idx on public.meal_plan_items (user_id);
create index meal_plan_items_recipe_idx on public.meal_plan_items (recipe_id) where recipe_id is not null;
create index meal_plan_items_food_idx on public.meal_plan_items (food_id) where food_id is not null;

create trigger meal_plan_items_set_updated_at
  before update on public.meal_plan_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shopping_lists / shopping_list_items
-- ---------------------------------------------------------------------------
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  currency_code char(3) not null default 'PEN' check (currency_code ~ '^[A-Z]{3}$'),
  budget numeric(10,2) check (budget is null or budget >= 0),
  share_token text unique check (share_token is null or char_length(share_token) between 16 and 128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_lists_user_idx on public.shopping_lists (user_id, created_at desc);
create index shopping_lists_plan_idx on public.shopping_lists (meal_plan_id) where meal_plan_id is not null;

create trigger shopping_lists_set_updated_at
  before update on public.shopping_lists
  for each row execute function public.set_updated_at();

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid references public.foods (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  category text,
  quantity numeric check (quantity is null or quantity > 0),
  unit text,
  checked boolean not null default false,
  estimated_price numeric(10,2) check (estimated_price is null or estimated_price >= 0),
  price_source text check (price_source is null or price_source in ('reference', 'user')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index shopping_list_items_list_idx on public.shopping_list_items (list_id, position);
create index shopping_list_items_user_idx on public.shopping_list_items (user_id);
create index shopping_list_items_food_idx on public.shopping_list_items (food_id) where food_id is not null;

create trigger shopping_list_items_set_updated_at
  before update on public.shopping_list_items
  for each row execute function public.set_updated_at();
