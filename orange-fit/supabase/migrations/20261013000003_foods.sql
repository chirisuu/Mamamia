-- ORANGE FIT · 003 · Catálogo de alimentos: marcas, alimentos (por 100 g), micronutrientes,
-- porciones y precios referenciales.

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  name_normalized text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index brands_name_normalized_key on public.brands (name_normalized);

-- ---------------------------------------------------------------------------
-- foods
-- ---------------------------------------------------------------------------
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  -- Lo mantiene el trigger foods_set_search_fields (no hace falta enviarlo).
  name_normalized text not null default '',
  brand_id uuid references public.brands (id) on delete set null,
  description text check (description is null or char_length(description) <= 2000),
  food_type text not null default 'generic' check (food_type in ('generic', 'branded', 'dish')),
  barcode text check (barcode is null or barcode ~ '^[0-9]{6,14}$'),
  country_codes text[] not null default '{}',
  -- Valores por 100 g.
  energy_kcal numeric(7,2) not null check (energy_kcal between 0 and 900),
  protein_g numeric(6,2) not null check (protein_g between 0 and 100),
  carbs_g numeric(6,2) not null check (carbs_g between 0 and 100),
  fat_g numeric(6,2) not null check (fat_g between 0 and 100),
  fiber_g numeric(6,2) check (fiber_g is null or fiber_g between 0 and 100),
  sugar_g numeric(6,2) check (sugar_g is null or sugar_g between 0 and 100),
  saturated_fat_g numeric(6,2) check (saturated_fat_g is null or saturated_fat_g between 0 and 100),
  sodium_mg numeric(8,2) check (sodium_mg is null or sodium_mg between 0 and 100000),
  density_g_per_ml numeric(5,3) check (density_g_per_ml is null or density_g_per_ml > 0),
  source public.food_source not null,
  source_ref text,
  source_url text,
  license text,
  verification_status public.verification_status not null default 'unverified',
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  -- Dueño si es alimento propio; null en el catálogo cargado por el equipo.
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  is_public boolean not null default false,
  -- Lo mantiene el trigger foods_set_search_fields (nombre + marca, sin tildes).
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.foods is
  'Alimentos por 100 g con procedencia (source/source_ref/license). Públicos para todos; propios solo para su dueño.';
comment on column public.foods.barcode is
  'Único entre alimentos públicos y, por separado, entre los alimentos propios de cada usuario.';

create index foods_name_normalized_trgm_idx on public.foods using gin (name_normalized extensions.gin_trgm_ops);
create index foods_search_idx on public.foods using gin (search);
create index foods_barcode_idx on public.foods (barcode) where barcode is not null;
-- Un código de barras público no puede repetirse; los alimentos propios no chocan con los públicos
-- ni revelan qué códigos registró otra persona.
create unique index foods_barcode_public_key on public.foods (barcode) where is_public and barcode is not null;
create unique index foods_barcode_owner_key on public.foods (created_by, barcode)
  where not is_public and barcode is not null;
create index foods_created_by_idx on public.foods (created_by) where created_by is not null;
create index foods_brand_id_idx on public.foods (brand_id) where brand_id is not null;
create index foods_public_name_idx on public.foods (name_normalized) where is_public;

create trigger foods_set_updated_at
  before update on public.foods
  for each row execute function public.set_updated_at();

create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

-- Mantiene name_normalized y search a partir del nombre y la marca.
create or replace function public.foods_set_search_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_brand text;
begin
  new.name_normalized := public.normalize_text(new.name);
  if new.brand_id is not null then
    select b.name into v_brand from public.brands b where b.id = new.brand_id;
  end if;
  new.search := to_tsvector('simple'::regconfig,
    public.normalize_text(coalesce(new.name, '') || ' ' || coalesce(v_brand, '')));
  return new;
end;
$$;

create trigger foods_set_search_fields
  before insert or update on public.foods
  for each row execute function public.foods_set_search_fields();

create or replace function public.brands_set_name_normalized()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.name_normalized := public.normalize_text(new.name);
  return new;
end;
$$;

create trigger brands_set_name_normalized
  before insert or update on public.brands
  for each row execute function public.brands_set_name_normalized();

-- Si cambia el nombre de una marca, se recalcula el índice de búsqueda de sus alimentos.
create or replace function public.brands_refresh_food_search()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.foods f set brand_id = f.brand_id where f.brand_id = new.id;
  return null;
end;
$$;

create trigger brands_refresh_food_search
  after update of name on public.brands
  for each row
  when (old.name is distinct from new.name)
  execute function public.brands_refresh_food_search();

-- ---------------------------------------------------------------------------
-- nutrient_definitions / food_nutrients (solo micronutrientes; los 8 núcleo viven en foods)
-- ---------------------------------------------------------------------------
create table public.nutrient_definitions (
  id smallint generated by default as identity primary key,
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name_es text not null,
  unit text not null check (unit in ('g', 'mg', 'µg')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger nutrient_definitions_set_updated_at
  before update on public.nutrient_definitions
  for each row execute function public.set_updated_at();

create table public.food_nutrients (
  food_id uuid not null references public.foods (id) on delete cascade,
  nutrient_id smallint not null references public.nutrient_definitions (id) on delete cascade,
  amount_per_100g numeric not null check (amount_per_100g >= 0),
  primary key (food_id, nutrient_id)
);

create index food_nutrients_nutrient_idx on public.food_nutrients (nutrient_id);

-- ---------------------------------------------------------------------------
-- food_portions
-- ---------------------------------------------------------------------------
create table public.food_portions (
  id uuid primary key default gen_random_uuid(),
  food_id uuid not null references public.foods (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 30),
  gram_weight numeric not null check (gram_weight > 0),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index food_portions_food_idx on public.food_portions (food_id);
create unique index food_portions_one_default on public.food_portions (food_id) where is_default;

create trigger food_portions_set_updated_at
  before update on public.food_portions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reference_prices (precio referencial, nunca "en tiempo real")
-- ---------------------------------------------------------------------------
create table public.reference_prices (
  id uuid primary key default gen_random_uuid(),
  food_id uuid references public.foods (id) on delete set null,
  item_name text not null check (char_length(item_name) between 1 and 200),
  country_code char(2) not null default 'PE' check (country_code ~ '^[A-Z]{2}$'),
  currency_code char(3) not null default 'PEN' check (currency_code ~ '^[A-Z]{3}$'),
  price numeric(10,2) not null check (price >= 0),
  per_quantity numeric not null default 1 check (per_quantity > 0),
  per_unit text not null check (per_unit in ('kg', 'l', 'unit')),
  source text not null check (char_length(source) between 1 and 300),
  observed_on date not null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reference_prices_food_idx on public.reference_prices (food_id) where food_id is not null;
create index reference_prices_country_item_idx on public.reference_prices (country_code, item_name);

create trigger reference_prices_set_updated_at
  before update on public.reference_prices
  for each row execute function public.set_updated_at();
