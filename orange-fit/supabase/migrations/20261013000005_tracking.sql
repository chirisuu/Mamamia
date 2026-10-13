-- ORANGE FIT · 005 · Seguimiento: agua, peso, medidas, fotos de progreso, ayuno y ejercicio.

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  logged_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, local_date);

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  weight_kg numeric(5,2) not null check (weight_kg between 20 and 400),
  body_fat_pct numeric(4,1) check (body_fat_pct is null or body_fat_pct between 2 and 75),
  body_fat_method text check (body_fat_method is null or char_length(body_fat_method) <= 40),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  waist_cm numeric(5,1) check (waist_cm is null or waist_cm between 10 and 300),
  hip_cm numeric(5,1) check (hip_cm is null or hip_cm between 10 and 300),
  chest_cm numeric(5,1) check (chest_cm is null or chest_cm between 10 and 300),
  arm_cm numeric(5,1) check (arm_cm is null or arm_cm between 5 and 150),
  thigh_cm numeric(5,1) check (thigh_cm is null or thigh_cm between 5 and 200),
  calf_cm numeric(5,1) check (calf_cm is null or calf_cm between 5 and 150),
  neck_cm numeric(5,1) check (neck_cm is null or neck_cm between 5 and 100),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, local_date)
);

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  -- Ruta dentro del bucket privado progress-photos: siempre bajo la carpeta del dueño.
  storage_path text not null,
  pose public.photo_pose not null default 'front',
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);

create index progress_photos_user_date_idx on public.progress_photos (user_id, local_date);

create table public.fasting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  protocol text not null check (protocol in ('12:12', '14:10', '16:8', '18:6', 'custom')),
  target_hours numeric(4,1) not null check (target_hours between 8 and 24),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status public.fasting_status not null default 'active',
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at),
  check (status = 'active' or ended_at is not null)
);

-- Una sesión de ayuno activa por usuario.
create unique index fasting_sessions_one_active on public.fasting_sessions (user_id) where status = 'active';
create index fasting_sessions_user_started_idx on public.fasting_sessions (user_id, started_at desc);

create trigger fasting_sessions_set_updated_at
  before update on public.fasting_sessions
  for each row execute function public.set_updated_at();

create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  activity_code text not null check (char_length(activity_code) between 1 and 60),
  activity_name text not null check (char_length(activity_name) between 1 and 120),
  met numeric(4,1) check (met is null or met between 0.5 and 25),
  duration_min integer not null check (duration_min between 1 and 600),
  intensity text check (intensity is null or intensity in ('light', 'moderate', 'vigorous')),
  energy_kcal numeric(7,1) not null check (energy_kcal between 0 and 10000),
  energy_source text not null default 'met_estimate' check (energy_source in ('met_estimate', 'manual', 'device')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

create index exercise_logs_user_date_idx on public.exercise_logs (user_id, local_date);
