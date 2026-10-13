-- ORANGE FIT · 002 · Usuarios: perfiles, roles, consentimientos, objetivos, metas y acceso profesional.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) <= 80),
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  sex public.sex_for_calc,
  height_cm numeric(5,1) check (height_cm is null or height_cm between 100 and 250),
  timezone text not null default 'America/Lima',
  country_code char(2) not null default 'PE' check (country_code ~ '^[A-Z]{2}$'),
  currency_code char(3) not null default 'PEN' check (currency_code ~ '^[A-Z]{3}$'),
  locale text not null default 'es-PE' check (char_length(locale) between 2 and 20),
  onboarding_completed_at timestamptz,
  avatar_path text,
  notification_prefs jsonb not null default '{}'::jsonb check (jsonb_typeof(notification_prefs) = 'object'),
  count_exercise_calories boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario de auth. Se crea con el trigger handle_new_user.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- La zona horaria define el día del diario (local_date): si no existe, falla aquí y no después.
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid default auth.uid() references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table public.user_roles is 'Roles del personal. superadmin ⊃ admin ⊃ editor; professional aparte. Solo superadmin escribe.';

-- ---------------------------------------------------------------------------
-- consents (historial: la fila más reciente por tipo manda)
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  consent_type public.consent_type not null,
  version text not null check (char_length(version) between 1 and 40),
  granted boolean not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index consents_user_type_created_idx on public.consents (user_id, consent_type, created_at desc);

-- ---------------------------------------------------------------------------
-- user_goals
-- ---------------------------------------------------------------------------
create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_type public.goal_type not null,
  current_weight_kg numeric(5,2) check (current_weight_kg is null or current_weight_kg between 20 and 400),
  target_weight_kg numeric(5,2) check (target_weight_kg is null or target_weight_kg between 20 and 400),
  -- Magnitud del cambio semanal (siempre ≥ 0; la dirección la da goal_type).
  weekly_rate_kg numeric(4,2) check (weekly_rate_kg is null or weekly_rate_kg between 0 and 2),
  activity_level public.activity_level not null default 'sedentary',
  training_days_per_week smallint check (training_days_per_week is null or training_days_per_week between 0 and 14),
  diet_pattern text check (diet_pattern is null or diet_pattern in (
    'omnivore', 'vegetarian', 'vegan', 'pescatarian', 'keto', 'low_carb', 'high_protein', 'mediterranean'
  )),
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  restrictions text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  weekly_budget numeric(10,2) check (weekly_budget is null or weekly_budget >= 0),
  budget_currency char(3) check (budget_currency is null or budget_currency ~ '^[A-Z]{3}$'),
  meals_per_day smallint check (meals_per_day is null or meals_per_day between 2 and 6),
  nutrition_experience text check (nutrition_experience is null or nutrition_experience in (
    'beginner', 'intermediate', 'advanced'
  )),
  health_flags text[] not null default '{}' check (health_flags <@ array[
    'pregnant', 'lactating', 'eating_disorder_history', 'diabetes_medication', 'kidney_disease', 'other_condition'
  ]::text[]),
  requires_professional_review boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Un solo objetivo activo por usuario.
create unique index user_goals_one_active_per_user on public.user_goals (user_id) where is_active;
create index user_goals_user_created_idx on public.user_goals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- nutrition_targets (vigente = mayor effective_from ≤ hoy; desempate created_at)
-- ---------------------------------------------------------------------------
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_from date not null default current_date,
  energy_kcal integer not null check (energy_kcal between 500 and 10000),
  protein_g integer not null check (protein_g between 0 and 1000),
  carbs_g integer not null check (carbs_g between 0 and 2000),
  fat_g integer not null check (fat_g between 0 and 1000),
  fiber_g integer check (fiber_g is null or fiber_g between 0 and 200),
  water_ml integer check (water_ml is null or water_ml between 0 and 10000),
  method text not null default 'mifflin_st_jeor' check (char_length(method) between 1 and 60),
  inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object'),
  source text not null default 'auto' check (source in ('auto', 'manual', 'professional')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index nutrition_targets_current_idx
  on public.nutrition_targets (user_id, effective_from desc, created_at desc);

-- ---------------------------------------------------------------------------
-- professional_access
-- ---------------------------------------------------------------------------
create table public.professional_access (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope text not null default 'read_logs_write_targets' check (scope in ('read_logs', 'read_logs_write_targets')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (professional_id <> user_id),
  check (revoked_at is null or revoked_at >= granted_at)
);

-- Un acceso vigente por par usuario/profesional.
create unique index professional_access_active_pair
  on public.professional_access (professional_id, user_id) where revoked_at is null;
create index professional_access_user_idx on public.professional_access (user_id);

-- ---------------------------------------------------------------------------
-- Funciones de autorización
-- ---------------------------------------------------------------------------

-- has_role: jerarquía superadmin ⊃ admin ⊃ editor; professional va aparte.
create or replace function public.has_role(role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (
        ur.role = has_role.role
        or (has_role.role = 'editor' and ur.role in ('admin', 'superadmin'))
        or (has_role.role = 'admin' and ur.role = 'superadmin')
      )
  );
$$;

comment on function public.has_role(public.app_role) is
  'true si el usuario actual tiene el rol (o uno superior en la jerarquía superadmin ⊃ admin ⊃ editor).';

-- has_professional_access: el usuario actual es profesional y tiene acceso vigente a target_user.
create or replace function public.has_professional_access(target_user uuid, require_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.professional_access pa
    join public.user_roles ur
      on ur.user_id = pa.professional_id and ur.role = 'professional'
    where pa.professional_id = (select auth.uid())
      and pa.user_id = has_professional_access.target_user
      and pa.revoked_at is null
      and (not has_professional_access.require_write or pa.scope = 'read_logs_write_targets')
  );
$$;

comment on function public.has_professional_access(uuid, boolean) is
  'true si el usuario actual (rol professional) tiene un acceso vigente a target_user; con require_write exige scope read_logs_write_targets.';

-- Solo se puede dar acceso a cuentas que de verdad tienen el rol professional.
create or replace function public.validate_professional_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
    where ur.user_id = new.professional_id and ur.role = 'professional'
  ) then
    raise exception 'La cuenta indicada no es un profesional registrado.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger professional_access_validate
  before insert or update of professional_id on public.professional_access
  for each row execute function public.validate_professional_access();

-- ---------------------------------------------------------------------------
-- handle_new_user: crea el perfil al registrarse
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), 80), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
