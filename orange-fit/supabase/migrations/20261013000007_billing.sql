-- ORANGE FIT · 007 · Planes, precios, suscripciones, pagos y eventos de facturación.
-- subscriptions/payments/billing_events solo los escribe el service role (webhooks).

create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  features text[] not null default '{}',
  -- {"photo":n,"text":n,"voice":n,"chat":n}; una clave ausente equivale a 0.
  ai_monthly_limits jsonb not null default '{}'::jsonb check (jsonb_typeof(ai_monthly_limits) = 'object'),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans (id) on update cascade,
  interval public.billing_interval not null,
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  amount_cents integer not null check (amount_cents >= 0),
  trial_days integer not null default 0 check (trial_days between 0 and 90),
  stripe_price_id text unique,
  mercadopago_plan_id text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un precio activo por plan, periodo y moneda.
create unique index plan_prices_active_key
  on public.plan_prices (plan_id, interval, currency_code) where is_active;

create trigger plan_prices_set_updated_at
  before update on public.plan_prices
  for each row execute function public.set_updated_at();

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id text not null references public.plans (id) on update cascade,
  price_id uuid references public.plan_prices (id) on delete set null,
  provider public.billing_provider not null,
  provider_customer_id text,
  provider_subscription_id text unique,
  status public.subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_status_idx on public.subscriptions (user_id, status);
create index subscriptions_canceled_at_idx on public.subscriptions (canceled_at) where canceled_at is not null;
create index subscriptions_price_idx on public.subscriptions (price_id) where price_id is not null;
create index subscriptions_plan_idx on public.subscriptions (plan_id);

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Nunca datos de tarjeta: solo ids del proveedor y montos.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  provider public.billing_provider not null,
  provider_payment_id text not null unique,
  amount_cents integer not null check (amount_cents >= 0),
  currency_code char(3) not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null check (status in ('succeeded', 'pending', 'failed', 'refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_subscription_idx on public.payments (subscription_id) where subscription_id is not null;
create index payments_paid_at_idx on public.payments (paid_at) where status = 'succeeded';

-- Idempotencia de webhooks.
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider public.billing_provider not null,
  event_id text not null,
  type text not null,
  processed_at timestamptz not null default now(),
  unique (provider, event_id)
);
