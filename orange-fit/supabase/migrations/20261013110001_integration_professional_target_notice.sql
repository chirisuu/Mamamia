-- Aviso dentro de la app cuando un profesional fija o cambia la meta de alguien.
-- El profesional no puede escribir notificaciones ajenas (RLS de notifications), así que el aviso
-- lo crea este trigger. Solo usa columnas de la propia fila: no expone nada del profesional.

create or replace function public.notify_professional_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source <> 'professional' or new.created_by is null or new.created_by = new.user_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and (old.energy_kcal, old.protein_g, old.carbs_g, old.fat_g, old.effective_from)
     is not distinct from (new.energy_kcal, new.protein_g, new.carbs_g, new.fat_g, new.effective_from) then
    return new;
  end if;
  insert into public.notifications (user_id, type, title, body, url)
  values (
    new.user_id,
    'professional_target',
    case when tg_op = 'INSERT' then 'Tu profesional fijó una meta nueva' else 'Tu profesional actualizó tu meta' end,
    format('Desde el %s: %s kcal, %s g de proteína, %s g de carbohidratos y %s g de grasa al día.',
           to_char(new.effective_from, 'DD/MM/YYYY'), new.energy_kcal, new.protein_g, new.carbs_g, new.fat_g),
    '/app/perfil/metas'
  );
  return new;
end;
$$;

revoke all on function public.notify_professional_target() from public, anon, authenticated;

drop trigger if exists nutrition_targets_professional_notice on public.nutrition_targets;
create trigger nutrition_targets_professional_notice
  after insert or update on public.nutrition_targets
  for each row execute function public.notify_professional_target();
