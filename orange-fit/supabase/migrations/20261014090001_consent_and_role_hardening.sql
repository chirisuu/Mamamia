-- ORANGE FIT · Endurecimiento tras la revisión de seguridad (docs/SECURITY.md §13, riesgos 5 y 6).
--
-- 1) El rol superadmin solo se otorga, cambia o quita por SQL (consola de Supabase o migración).
--    Antes, un superadmin podía crear otro por la API: el panel lo impedía con Zod, el RLS no.
-- 2) Sin permiso de datos de salud vigente (Ley 29733, art. 13.6: datos sensibles), ningún profesional
--    puede leer ni escribir los registros de la persona, aunque su acceso siga vigente. Al volver a
--    autorizar, el acceso se reanuda.

-- 1) user_roles ---------------------------------------------------------------
drop policy if exists user_roles_insert_superadmin on public.user_roles;
drop policy if exists user_roles_update_superadmin on public.user_roles;
drop policy if exists user_roles_delete_superadmin on public.user_roles;

create policy user_roles_insert_superadmin on public.user_roles
  for insert to authenticated
  with check ((select public.has_role('superadmin')) and role <> 'superadmin');
create policy user_roles_update_superadmin on public.user_roles
  for update to authenticated
  using ((select public.has_role('superadmin')) and role <> 'superadmin')
  with check ((select public.has_role('superadmin')) and role <> 'superadmin');
create policy user_roles_delete_superadmin on public.user_roles
  for delete to authenticated
  using ((select public.has_role('superadmin')) and role <> 'superadmin');

-- 2) Permiso de datos de salud --------------------------------------------------
-- Vigente = la última decisión registrada para health_data es «otorgado» (consents es un historial).
create or replace function public.has_health_consent(target_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted
    from public.consents c
    where c.user_id = has_health_consent.target_user
      and c.consent_type = 'health_data'
    order by c.created_at desc, c.id desc
    limit 1
  ), false);
$$;

comment on function public.has_health_consent(uuid) is
  'true si la última decisión de target_user sobre health_data es otorgar el permiso.';

revoke all on function public.has_health_consent(uuid) from public, anon;
grant execute on function public.has_health_consent(uuid) to authenticated, service_role;

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
  )
  and public.has_health_consent(has_professional_access.target_user);
$$;

comment on function public.has_professional_access(uuid, boolean) is
  'true si el usuario actual (rol professional) tiene un acceso vigente a target_user y target_user mantiene su permiso de datos de salud; con require_write exige scope read_logs_write_targets.';
