-- ORANGE FIT · 001 · Extensiones, enums y utilidades comunes.
-- Contrato: docs/DATA_MODEL.md. Las extensiones viven en el schema `extensions`
-- para no ensuciar `public` (que se expone por la API).

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('superadmin', 'admin', 'editor', 'professional');
create type public.sex_for_calc as enum ('male', 'female');
create type public.activity_level as enum ('sedentary', 'light', 'moderate', 'active', 'very_active');
create type public.goal_type as enum ('lose_fat', 'gain_muscle', 'maintain', 'recomposition', 'improve_habits');
create type public.meal_type as enum ('breakfast', 'lunch', 'dinner', 'snack', 'custom');
create type public.log_source as enum (
  'manual', 'search', 'barcode', 'photo_ai', 'voice_ai', 'text_ai', 'recipe', 'plan', 'template', 'copy'
);
create type public.food_source as enum ('usda', 'open_food_facts', 'curated', 'user', 'admin');
create type public.verification_status as enum ('unverified', 'curated', 'verified', 'rejected');
create type public.recipe_status as enum ('draft', 'pending_review', 'published', 'rejected');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'paused', 'expired'
);
create type public.billing_provider as enum ('stripe', 'mercadopago');
create type public.billing_interval as enum ('month', 'year');
create type public.ai_request_kind as enum ('photo', 'text', 'voice', 'chat', 'plan');
create type public.ai_request_status as enum ('pending', 'succeeded', 'failed', 'rejected_quota', 'not_configured');
create type public.consent_type as enum (
  'terms', 'privacy', 'health_data', 'ai_processing', 'progress_photos', 'marketing'
);
create type public.fasting_status as enum ('active', 'completed', 'cancelled');
create type public.photo_pose as enum ('front', 'side', 'back', 'other');

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

-- Trigger genérico para mantener updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Igual que set_updated_at pero además registra quién hizo el cambio (tablas de admin/contenido).
create or replace function public.set_updated_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

-- Normaliza texto para búsquedas: sin tildes, minúsculas, espacios simples.
-- Es security definer porque `unaccent` vive en `extensions` y se llama desde
-- triggers que corren con el rol del usuario.
create or replace function public.normalize_text(value text)
returns text
language sql
immutable
parallel safe
security definer
set search_path = ''
as $$
  select lower(btrim(regexp_replace(
    extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, '')),
    '\s+', ' ', 'g'
  )));
$$;

comment on function public.normalize_text(text) is
  'Texto sin tildes, en minúsculas y con espacios colapsados. Base de name_normalized y de search_foods.';
