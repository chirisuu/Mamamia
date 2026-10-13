-- ORANGE FIT · 008 · Administración: ajustes, contenidos, auditoría, reportes de error y rate limits.

create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  value jsonb not null default 'null'::jsonb,
  description text,
  -- false = clave sensible: solo la lee un admin (y el service role).
  is_public boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_audit
  before insert or update on public.app_settings
  for each row execute function public.set_updated_audit();

create table public.content_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  body_md text not null default '',
  kind text not null check (kind in ('faq', 'legal', 'landing_block', 'article')),
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index content_pages_kind_idx on public.content_pages (kind, status, sort_order);

create trigger content_pages_set_updated_audit
  before insert or update on public.content_pages
  for each row execute function public.set_updated_audit();

-- Solo se inserta vía log_admin_action(); lectura admin.
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  target_table text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index admin_audit_logs_actor_idx on public.admin_audit_logs (actor_id) where actor_id is not null;

create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 2000),
  route text check (route is null or char_length(route) <= 500),
  digest text check (digest is null or char_length(digest) <= 200),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  status text not null default 'new' check (status in ('new', 'triaged', 'resolved')),
  created_at timestamptz not null default now()
);

create index error_reports_status_created_idx on public.error_reports (status, created_at desc);
create index error_reports_user_idx on public.error_reports (user_id) where user_id is not null;

-- Contadores de ventana fija. Solo los tocan funciones (check_rate_limit).
create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);
