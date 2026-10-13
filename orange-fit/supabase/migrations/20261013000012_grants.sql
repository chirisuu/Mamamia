-- ORANGE FIT · 012 · Privilegios: defensa en profundidad además del RLS.
-- Supabase da EXECUTE en funciones nuevas de public a anon/authenticated por defecto; aquí se
-- quita y se concede solo lo que la app usa. El service role conserva sus permisos.

revoke execute on all functions in schema public from public, anon, authenticated;

-- Utilidades puras y de autorización (se usan dentro de políticas RLS).
grant execute on function public.normalize_text(text) to anon, authenticated, service_role;
grant execute on function public.has_role(public.app_role) to anon, authenticated, service_role;
grant execute on function public.has_professional_access(uuid, boolean) to authenticated, service_role;

-- RPC de la app.
grant execute on function public.is_premium(uuid) to authenticated, service_role;
grant execute on function public.consume_ai_quota(public.ai_request_kind) to authenticated;
grant execute on function public.complete_ai_request(
  uuid, public.ai_request_status, text, text, jsonb, text, integer, integer, numeric, integer, text
) to authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.admin_metrics() to authenticated, service_role;
grant execute on function public.get_shared_plan(text) to anon, authenticated, service_role;
grant execute on function public.search_foods(text, integer) to anon, authenticated, service_role;
grant execute on function public.register_push_subscription(text, text, text) to authenticated;

-- Las funciones de trigger y request_role() no se exponen como RPC (solo service_role por defecto).

-- ---------------------------------------------------------------------------
-- Tablas que solo tocan funciones o el service role
-- ---------------------------------------------------------------------------
revoke all on table public.rate_limits from anon, authenticated;
revoke all on table public.billing_events from anon, authenticated;

-- Cobros: el dueño solo lee; anon nada.
revoke all on table public.subscriptions, public.payments from anon;
revoke insert, update, delete on table public.subscriptions, public.payments from authenticated;

-- Auditoría: solo vía log_admin_action().
revoke all on table public.admin_audit_logs from anon;
revoke insert, update, delete on table public.admin_audit_logs from authenticated;

-- Cuota de IA: solo vía consume_ai_quota()/complete_ai_request().
revoke all on table public.ai_analysis_requests from anon;
revoke insert, update, delete on table public.ai_analysis_requests from authenticated;

-- TRUNCATE no pasa por RLS: nadie desde la API.
revoke truncate on all tables in schema public from anon, authenticated;
