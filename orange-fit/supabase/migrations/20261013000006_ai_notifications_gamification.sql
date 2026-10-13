-- ORANGE FIT · 006 · IA (solicitudes y asistente), notificaciones y gamificación.

-- ---------------------------------------------------------------------------
-- ai_analysis_requests: cada uso de IA. Se crea con consume_ai_quota() y se cierra con
-- complete_ai_request(); el usuario solo lee las suyas (no puede tocar su propia cuota).
-- No guarda texto libre del usuario fuera de `output`.
-- ---------------------------------------------------------------------------
create table public.ai_analysis_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind public.ai_request_kind not null,
  provider text,
  model text,
  status public.ai_request_status not null default 'pending',
  input_storage_path text,
  output jsonb,
  error_code text check (error_code is null or char_length(error_code) <= 100),
  tokens_input integer check (tokens_input is null or tokens_input >= 0),
  tokens_output integer check (tokens_output is null or tokens_output >= 0),
  estimated_cost_usd numeric(10,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default now()
);

create index ai_analysis_requests_quota_idx on public.ai_analysis_requests (user_id, kind, created_at desc);
create index ai_analysis_requests_created_idx on public.ai_analysis_requests (created_at);

alter table public.meal_log_items
  add constraint meal_log_items_ai_request_id_fkey
  foreign key (ai_request_id) references public.ai_analysis_requests (id) on delete set null;

create index meal_log_items_ai_request_idx on public.meal_log_items (ai_request_id) where ai_request_id is not null;

-- ---------------------------------------------------------------------------
-- Asistente
-- ---------------------------------------------------------------------------
create table public.assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or char_length(title) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_conversations_user_idx on public.assistant_conversations (user_id, updated_at desc);

create trigger assistant_conversations_set_updated_at
  before update on public.assistant_conversations
  for each row execute function public.set_updated_at();

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.assistant_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 20000),
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index assistant_messages_conversation_idx on public.assistant_messages (conversation_id, created_at);
create index assistant_messages_user_idx on public.assistant_messages (user_id);

-- ---------------------------------------------------------------------------
-- Notificaciones
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) between 1 and 60),
  title text not null check (char_length(title) between 1 and 200),
  body text check (body is null or char_length(body) <= 2000),
  url text check (url is null or char_length(url) <= 500),
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (scheduled_for) where sent_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) <= 2000),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- Gamificación (sin castigos: solo se suman logros)
-- ---------------------------------------------------------------------------
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  icon text not null default 'award', -- nombre de icono lucide
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger badges_set_updated_at
  before update on public.badges
  for each row execute function public.set_updated_at();

create table public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index user_badges_badge_idx on public.user_badges (badge_id);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9_]+$'),
  title text not null,
  description text,
  kind text not null check (kind in ('water', 'logging', 'protein', 'vegetables', 'activity')),
  target_value numeric not null check (target_value > 0),
  duration_days integer not null check (duration_days between 1 and 90),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger challenges_set_updated_at
  before update on public.challenges
  for each row execute function public.set_updated_at();

create table public.user_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  started_on date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index user_challenges_one_active
  on public.user_challenges (user_id, challenge_id) where status = 'active';
create index user_challenges_challenge_idx on public.user_challenges (challenge_id);

create trigger user_challenges_set_updated_at
  before update on public.user_challenges
  for each row execute function public.set_updated_at();
