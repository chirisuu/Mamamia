-- ORANGE FIT · 010 · Row Level Security en TODAS las tablas de public.
-- Patrones:
--   dueño     user_id = (select auth.uid())
--   staff     (select public.has_role('editor'))   — editor, admin y superadmin
--   admin     (select public.has_role('admin'))
--   profesional con acceso vigente: public.has_professional_access(user_id)
-- Las tablas sin política para un rol/operación quedan cerradas para ese rol.
-- `(select …)` hace que auth.uid()/has_role() se evalúen una vez por consulta y no por fila.

-- ---------------------------------------------------------------------------
-- Activar RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.consents enable row level security;
alter table public.user_goals enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.professional_access enable row level security;
alter table public.brands enable row level security;
alter table public.foods enable row level security;
alter table public.nutrient_definitions enable row level security;
alter table public.food_nutrients enable row level security;
alter table public.food_portions enable row level security;
alter table public.reference_prices enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.user_favorites enable row level security;
alter table public.meal_templates enable row level security;
alter table public.meal_template_items enable row level security;
alter table public.meal_logs enable row level security;
alter table public.meal_log_items enable row level security;
alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.water_logs enable row level security;
alter table public.weight_logs enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.fasting_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.ai_analysis_requests enable row level security;
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenges enable row level security;
alter table public.user_challenges enable row level security;
alter table public.plans enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.billing_events enable row level security;
alter table public.app_settings enable row level security;
alter table public.content_pages enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.error_reports enable row level security;
alter table public.rate_limits enable row level security;

-- ===========================================================================
-- Usuarios
-- ===========================================================================

-- profiles -------------------------------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles
  for select to authenticated using ((select public.has_role('admin')));
create policy profiles_select_professional on public.profiles
  for select to authenticated using (public.has_professional_access(id));
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- Sin DELETE: el perfil se va con la cuenta (cascade desde auth.users).

-- user_roles -----------------------------------------------------------------
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_roles_select_admin on public.user_roles
  for select to authenticated using ((select public.has_role('admin')));
create policy user_roles_insert_superadmin on public.user_roles
  for insert to authenticated with check ((select public.has_role('superadmin')));
create policy user_roles_update_superadmin on public.user_roles
  for update to authenticated
  using ((select public.has_role('superadmin')))
  with check ((select public.has_role('superadmin')));
create policy user_roles_delete_superadmin on public.user_roles
  for delete to authenticated using ((select public.has_role('superadmin')));

-- consents (historial: solo lectura e inserción) -----------------------------
create policy consents_select_own on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy consents_insert_own on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

-- user_goals -----------------------------------------------------------------
create policy user_goals_select_own on public.user_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_goals_select_professional on public.user_goals
  for select to authenticated using (public.has_professional_access(user_id));
create policy user_goals_insert_own on public.user_goals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_goals_update_own on public.user_goals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_goals_delete_own on public.user_goals
  for delete to authenticated using (user_id = (select auth.uid()));

-- nutrition_targets ----------------------------------------------------------
create policy nutrition_targets_select_own on public.nutrition_targets
  for select to authenticated using (user_id = (select auth.uid()));
create policy nutrition_targets_select_professional on public.nutrition_targets
  for select to authenticated using (public.has_professional_access(user_id));
-- El usuario no puede hacerse pasar por profesional.
create policy nutrition_targets_insert_own on public.nutrition_targets
  for insert to authenticated
  with check (user_id = (select auth.uid()) and source in ('auto', 'manual'));
create policy nutrition_targets_insert_professional on public.nutrition_targets
  for insert to authenticated
  with check (
    source = 'professional'
    and created_by = (select auth.uid())
    and public.has_professional_access(user_id, true)
  );
create policy nutrition_targets_update_own on public.nutrition_targets
  for update to authenticated
  using (user_id = (select auth.uid()) and source <> 'professional')
  with check (user_id = (select auth.uid()) and source in ('auto', 'manual'));
create policy nutrition_targets_update_professional on public.nutrition_targets
  for update to authenticated
  using (source = 'professional' and created_by = (select auth.uid()) and public.has_professional_access(user_id, true))
  with check (source = 'professional' and created_by = (select auth.uid()) and public.has_professional_access(user_id, true));
create policy nutrition_targets_delete_own on public.nutrition_targets
  for delete to authenticated using (user_id = (select auth.uid()));
create policy nutrition_targets_delete_professional on public.nutrition_targets
  for delete to authenticated
  using (source = 'professional' and created_by = (select auth.uid()) and public.has_professional_access(user_id, true));

-- professional_access --------------------------------------------------------
create policy professional_access_select_own on public.professional_access
  for select to authenticated using (user_id = (select auth.uid()));
create policy professional_access_select_professional on public.professional_access
  for select to authenticated using (professional_id = (select auth.uid()));
create policy professional_access_insert_own on public.professional_access
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy professional_access_update_own on public.professional_access
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy professional_access_delete_own on public.professional_access
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===========================================================================
-- Alimentos
-- ===========================================================================

-- brands (catálogo abierto; cualquiera con sesión puede proponer una marca) ---
create policy brands_select_all on public.brands
  for select to anon, authenticated using (true);
create policy brands_insert_authenticated on public.brands
  for insert to authenticated with check (true);
create policy brands_update_staff on public.brands
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy brands_delete_staff on public.brands
  for delete to authenticated using ((select public.has_role('editor')));

-- foods ----------------------------------------------------------------------
create policy foods_select_public on public.foods
  for select to anon, authenticated using (is_public);
create policy foods_select_own on public.foods
  for select to authenticated using (created_by = (select auth.uid()));
create policy foods_select_staff on public.foods
  for select to authenticated using ((select public.has_role('editor')));
-- Alimento propio: nunca público ni "verificado" por el mismo usuario.
create policy foods_insert_own on public.foods
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and not is_public
    and source in ('user', 'open_food_facts', 'usda')
    and verification_status = 'unverified'
    and verified_by is null
    and verified_at is null
  );
create policy foods_insert_staff on public.foods
  for insert to authenticated with check ((select public.has_role('editor')));
create policy foods_update_own on public.foods
  for update to authenticated
  using (created_by = (select auth.uid()) and not is_public)
  with check (
    created_by = (select auth.uid())
    and not is_public
    and source in ('user', 'open_food_facts', 'usda')
    and verification_status = 'unverified'
    and verified_by is null
    and verified_at is null
  );
create policy foods_update_staff on public.foods
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy foods_delete_own on public.foods
  for delete to authenticated using (created_by = (select auth.uid()) and not is_public);
create policy foods_delete_staff on public.foods
  for delete to authenticated using ((select public.has_role('editor')));

-- nutrient_definitions -------------------------------------------------------
create policy nutrient_definitions_select_all on public.nutrient_definitions
  for select to anon, authenticated using (true);
create policy nutrient_definitions_insert_staff on public.nutrient_definitions
  for insert to authenticated with check ((select public.has_role('editor')));
create policy nutrient_definitions_update_staff on public.nutrient_definitions
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy nutrient_definitions_delete_staff on public.nutrient_definitions
  for delete to authenticated using ((select public.has_role('editor')));

-- food_nutrients (visibles si el alimento es visible; el subselect respeta el RLS de foods) ----
create policy food_nutrients_select_visible on public.food_nutrients
  for select to anon, authenticated
  using (exists (select 1 from public.foods f where f.id = food_nutrients.food_id));
create policy food_nutrients_insert_owner_or_staff on public.food_nutrients
  for insert to authenticated
  with check (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_nutrients.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );
create policy food_nutrients_update_owner_or_staff on public.food_nutrients
  for update to authenticated
  using (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_nutrients.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  )
  with check (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_nutrients.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );
create policy food_nutrients_delete_owner_or_staff on public.food_nutrients
  for delete to authenticated
  using (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_nutrients.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );

-- food_portions (mismo patrón) -------------------------------------------------
create policy food_portions_select_visible on public.food_portions
  for select to anon, authenticated
  using (exists (select 1 from public.foods f where f.id = food_portions.food_id));
create policy food_portions_insert_owner_or_staff on public.food_portions
  for insert to authenticated
  with check (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_portions.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );
create policy food_portions_update_owner_or_staff on public.food_portions
  for update to authenticated
  using (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_portions.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  )
  with check (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_portions.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );
create policy food_portions_delete_owner_or_staff on public.food_portions
  for delete to authenticated
  using (
    (select public.has_role('editor'))
    or exists (
      select 1 from public.foods f
      where f.id = food_portions.food_id and f.created_by = (select auth.uid()) and not f.is_public
    )
  );

-- reference_prices -----------------------------------------------------------
create policy reference_prices_select_all on public.reference_prices
  for select to anon, authenticated using (true);
create policy reference_prices_insert_staff on public.reference_prices
  for insert to authenticated with check ((select public.has_role('editor')));
create policy reference_prices_update_staff on public.reference_prices
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy reference_prices_delete_staff on public.reference_prices
  for delete to authenticated using ((select public.has_role('editor')));

-- ===========================================================================
-- Recetas y planes
-- ===========================================================================

-- recipes --------------------------------------------------------------------
create policy recipes_select_published on public.recipes
  for select to anon, authenticated using (status = 'published' and is_public);
create policy recipes_select_own on public.recipes
  for select to authenticated using (owner_id = (select auth.uid()));
create policy recipes_select_staff on public.recipes
  for select to authenticated using ((select public.has_role('editor')));
-- El dueño escribe; publicar (o rechazar) es solo del staff.
create policy recipes_insert_own on public.recipes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status in ('draft', 'pending_review'));
create policy recipes_insert_staff on public.recipes
  for insert to authenticated with check ((select public.has_role('editor')));
create policy recipes_update_own on public.recipes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and status in ('draft', 'pending_review'));
create policy recipes_update_staff on public.recipes
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy recipes_delete_own on public.recipes
  for delete to authenticated using (owner_id = (select auth.uid()));
create policy recipes_delete_staff on public.recipes
  for delete to authenticated using ((select public.has_role('editor')));

-- recipe_ingredients (visibles si la receta es visible) -------------------------
create policy recipe_ingredients_select_visible on public.recipe_ingredients
  for select to anon, authenticated
  using (exists (select 1 from public.recipes r where r.id = recipe_ingredients.recipe_id));
create policy recipe_ingredients_insert_owner_or_staff on public.recipe_ingredients
  for insert to authenticated
  with check (
    (
      (select public.has_role('editor'))
      or exists (select 1 from public.recipes r
                 where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid()))
    )
    -- Solo alimentos que quien escribe puede ver.
    and exists (select 1 from public.foods f where f.id = recipe_ingredients.food_id)
  );
create policy recipe_ingredients_update_owner_or_staff on public.recipe_ingredients
  for update to authenticated
  using (
    (select public.has_role('editor'))
    or exists (select 1 from public.recipes r
               where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid()))
  )
  with check (
    (
      (select public.has_role('editor'))
      or exists (select 1 from public.recipes r
                 where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid()))
    )
    and exists (select 1 from public.foods f where f.id = recipe_ingredients.food_id)
  );
create policy recipe_ingredients_delete_owner_or_staff on public.recipe_ingredients
  for delete to authenticated
  using (
    (select public.has_role('editor'))
    or exists (select 1 from public.recipes r
               where r.id = recipe_ingredients.recipe_id and r.owner_id = (select auth.uid()))
  );

-- user_favorites -------------------------------------------------------------
create policy user_favorites_select_own on public.user_favorites
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_favorites_insert_own on public.user_favorites
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_favorites_update_own on public.user_favorites
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_favorites_delete_own on public.user_favorites
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_templates -------------------------------------------------------------
create policy meal_templates_select_own on public.meal_templates
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_templates_insert_own on public.meal_templates
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meal_templates_update_own on public.meal_templates
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy meal_templates_delete_own on public.meal_templates
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_template_items (el padre también debe ser tuyo) ---------------------------
create policy meal_template_items_select_own on public.meal_template_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_template_items_insert_own on public.meal_template_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_templates t
                where t.id = meal_template_items.template_id and t.user_id = (select auth.uid()))
  );
create policy meal_template_items_update_own on public.meal_template_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_templates t
                where t.id = meal_template_items.template_id and t.user_id = (select auth.uid()))
  );
create policy meal_template_items_delete_own on public.meal_template_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_logs ------------------------------------------------------------------
create policy meal_logs_select_own on public.meal_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_logs_select_professional on public.meal_logs
  for select to authenticated using (public.has_professional_access(user_id));
create policy meal_logs_insert_own on public.meal_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meal_logs_update_own on public.meal_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy meal_logs_delete_own on public.meal_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_log_items -------------------------------------------------------------
create policy meal_log_items_select_own on public.meal_log_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_log_items_select_professional on public.meal_log_items
  for select to authenticated using (public.has_professional_access(user_id));
create policy meal_log_items_insert_own on public.meal_log_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_logs ml
                where ml.id = meal_log_items.meal_log_id and ml.user_id = (select auth.uid()))
  );
create policy meal_log_items_update_own on public.meal_log_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_logs ml
                where ml.id = meal_log_items.meal_log_id and ml.user_id = (select auth.uid()))
  );
create policy meal_log_items_delete_own on public.meal_log_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_plans -----------------------------------------------------------------
-- La lectura por share_token es solo vía get_shared_plan().
create policy meal_plans_select_own on public.meal_plans
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_plans_insert_own on public.meal_plans
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy meal_plans_update_own on public.meal_plans
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy meal_plans_delete_own on public.meal_plans
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_plan_items ------------------------------------------------------------
create policy meal_plan_items_select_own on public.meal_plan_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy meal_plan_items_insert_own on public.meal_plan_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans mp
                where mp.id = meal_plan_items.plan_id and mp.user_id = (select auth.uid()))
  );
create policy meal_plan_items_update_own on public.meal_plan_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.meal_plans mp
                where mp.id = meal_plan_items.plan_id and mp.user_id = (select auth.uid()))
  );
create policy meal_plan_items_delete_own on public.meal_plan_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- shopping_lists -------------------------------------------------------------
create policy shopping_lists_select_own on public.shopping_lists
  for select to authenticated using (user_id = (select auth.uid()));
create policy shopping_lists_insert_own on public.shopping_lists
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (meal_plan_id is null or exists (
      select 1 from public.meal_plans mp
      where mp.id = shopping_lists.meal_plan_id and mp.user_id = (select auth.uid())
    ))
  );
create policy shopping_lists_update_own on public.shopping_lists
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (meal_plan_id is null or exists (
      select 1 from public.meal_plans mp
      where mp.id = shopping_lists.meal_plan_id and mp.user_id = (select auth.uid())
    ))
  );
create policy shopping_lists_delete_own on public.shopping_lists
  for delete to authenticated using (user_id = (select auth.uid()));

-- shopping_list_items --------------------------------------------------------
create policy shopping_list_items_select_own on public.shopping_list_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy shopping_list_items_insert_own on public.shopping_list_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shopping_lists sl
                where sl.id = shopping_list_items.list_id and sl.user_id = (select auth.uid()))
  );
create policy shopping_list_items_update_own on public.shopping_list_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shopping_lists sl
                where sl.id = shopping_list_items.list_id and sl.user_id = (select auth.uid()))
  );
create policy shopping_list_items_delete_own on public.shopping_list_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===========================================================================
-- Seguimiento
-- ===========================================================================

-- water_logs -----------------------------------------------------------------
create policy water_logs_select_own on public.water_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy water_logs_insert_own on public.water_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy water_logs_update_own on public.water_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy water_logs_delete_own on public.water_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- weight_logs ----------------------------------------------------------------
create policy weight_logs_select_own on public.weight_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy weight_logs_select_professional on public.weight_logs
  for select to authenticated using (public.has_professional_access(user_id));
create policy weight_logs_insert_own on public.weight_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy weight_logs_update_own on public.weight_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy weight_logs_delete_own on public.weight_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- body_measurements ----------------------------------------------------------
create policy body_measurements_select_own on public.body_measurements
  for select to authenticated using (user_id = (select auth.uid()));
create policy body_measurements_insert_own on public.body_measurements
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy body_measurements_update_own on public.body_measurements
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy body_measurements_delete_own on public.body_measurements
  for delete to authenticated using (user_id = (select auth.uid()));

-- progress_photos ------------------------------------------------------------
create policy progress_photos_select_own on public.progress_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy progress_photos_insert_own on public.progress_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy progress_photos_update_own on public.progress_photos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy progress_photos_delete_own on public.progress_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- fasting_sessions -----------------------------------------------------------
create policy fasting_sessions_select_own on public.fasting_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy fasting_sessions_insert_own on public.fasting_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy fasting_sessions_update_own on public.fasting_sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy fasting_sessions_delete_own on public.fasting_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

-- exercise_logs --------------------------------------------------------------
create policy exercise_logs_select_own on public.exercise_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy exercise_logs_insert_own on public.exercise_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy exercise_logs_update_own on public.exercise_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy exercise_logs_delete_own on public.exercise_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===========================================================================
-- IA y asistente
-- ===========================================================================

-- ai_analysis_requests: solo lectura propia; se escribe con consume_ai_quota/complete_ai_request.
create policy ai_analysis_requests_select_own on public.ai_analysis_requests
  for select to authenticated using (user_id = (select auth.uid()));

-- assistant_conversations ----------------------------------------------------
create policy assistant_conversations_select_own on public.assistant_conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy assistant_conversations_insert_own on public.assistant_conversations
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy assistant_conversations_update_own on public.assistant_conversations
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy assistant_conversations_delete_own on public.assistant_conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- assistant_messages ---------------------------------------------------------
create policy assistant_messages_select_own on public.assistant_messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy assistant_messages_insert_own on public.assistant_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.assistant_conversations c
                where c.id = assistant_messages.conversation_id and c.user_id = (select auth.uid()))
  );
create policy assistant_messages_update_own on public.assistant_messages
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.assistant_conversations c
                where c.id = assistant_messages.conversation_id and c.user_id = (select auth.uid()))
  );
create policy assistant_messages_delete_own on public.assistant_messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===========================================================================
-- Notificaciones y gamificación
-- ===========================================================================

-- notifications --------------------------------------------------------------
create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_insert_own on public.notifications
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- push_subscriptions ---------------------------------------------------------
create policy push_subscriptions_select_own on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update_own on public.push_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));

-- badges ---------------------------------------------------------------------
create policy badges_select_active on public.badges
  for select to anon, authenticated using (is_active);
create policy badges_select_staff on public.badges
  for select to authenticated using ((select public.has_role('editor')));
create policy badges_insert_staff on public.badges
  for insert to authenticated with check ((select public.has_role('editor')));
create policy badges_update_staff on public.badges
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy badges_delete_staff on public.badges
  for delete to authenticated using ((select public.has_role('editor')));

-- user_badges ----------------------------------------------------------------
create policy user_badges_select_own on public.user_badges
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_badges_insert_own on public.user_badges
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_badges_delete_own on public.user_badges
  for delete to authenticated using (user_id = (select auth.uid()));

-- challenges -----------------------------------------------------------------
create policy challenges_select_active on public.challenges
  for select to anon, authenticated using (is_active);
create policy challenges_select_staff on public.challenges
  for select to authenticated using ((select public.has_role('editor')));
create policy challenges_insert_staff on public.challenges
  for insert to authenticated with check ((select public.has_role('editor')));
create policy challenges_update_staff on public.challenges
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy challenges_delete_staff on public.challenges
  for delete to authenticated using ((select public.has_role('editor')));

-- user_challenges ------------------------------------------------------------
create policy user_challenges_select_own on public.user_challenges
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_challenges_insert_own on public.user_challenges
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_challenges_update_own on public.user_challenges
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy user_challenges_delete_own on public.user_challenges
  for delete to authenticated using (user_id = (select auth.uid()));

-- ===========================================================================
-- Planes y pagos
-- ===========================================================================

-- plans / plan_prices: lectura pública de lo activo; escritura admin ----------
create policy plans_select_active on public.plans
  for select to anon, authenticated using (is_active);
create policy plans_select_admin on public.plans
  for select to authenticated using ((select public.has_role('admin')));
create policy plans_insert_admin on public.plans
  for insert to authenticated with check ((select public.has_role('admin')));
create policy plans_update_admin on public.plans
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));
create policy plans_delete_admin on public.plans
  for delete to authenticated using ((select public.has_role('admin')));

create policy plan_prices_select_active on public.plan_prices
  for select to anon, authenticated using (is_active);
create policy plan_prices_select_admin on public.plan_prices
  for select to authenticated using ((select public.has_role('admin')));
create policy plan_prices_insert_admin on public.plan_prices
  for insert to authenticated with check ((select public.has_role('admin')));
create policy plan_prices_update_admin on public.plan_prices
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));
create policy plan_prices_delete_admin on public.plan_prices
  for delete to authenticated using ((select public.has_role('admin')));

-- subscriptions / payments: lectura del dueño (y admin). Sin políticas de escritura:
-- solo el service role (webhooks) escribe.
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_select_admin on public.subscriptions
  for select to authenticated using ((select public.has_role('admin')));

create policy payments_select_own on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
create policy payments_select_admin on public.payments
  for select to authenticated using ((select public.has_role('admin')));

-- billing_events: sin políticas (solo service role).

-- ===========================================================================
-- Administración
-- ===========================================================================

-- app_settings ---------------------------------------------------------------
create policy app_settings_select_public on public.app_settings
  for select to anon, authenticated using (is_public);
create policy app_settings_select_admin on public.app_settings
  for select to authenticated using ((select public.has_role('admin')));
create policy app_settings_insert_admin on public.app_settings
  for insert to authenticated with check ((select public.has_role('admin')));
create policy app_settings_update_admin on public.app_settings
  for update to authenticated
  using ((select public.has_role('admin')))
  with check ((select public.has_role('admin')));
create policy app_settings_delete_admin on public.app_settings
  for delete to authenticated using ((select public.has_role('admin')));

-- content_pages --------------------------------------------------------------
create policy content_pages_select_published on public.content_pages
  for select to anon, authenticated using (status = 'published');
create policy content_pages_select_staff on public.content_pages
  for select to authenticated using ((select public.has_role('editor')));
create policy content_pages_insert_staff on public.content_pages
  for insert to authenticated with check ((select public.has_role('editor')));
create policy content_pages_update_staff on public.content_pages
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy content_pages_delete_staff on public.content_pages
  for delete to authenticated using ((select public.has_role('editor')));

-- admin_audit_logs: lectura admin; inserción solo vía log_admin_action() -----
create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select to authenticated using ((select public.has_role('admin')));

-- error_reports --------------------------------------------------------------
create policy error_reports_insert_anon on public.error_reports
  for insert to anon with check (user_id is null and status = 'new');
create policy error_reports_insert_authenticated on public.error_reports
  for insert to authenticated
  with check ((user_id is null or user_id = (select auth.uid())) and status = 'new');
create policy error_reports_select_staff on public.error_reports
  for select to authenticated using ((select public.has_role('editor')));
create policy error_reports_update_staff on public.error_reports
  for update to authenticated
  using ((select public.has_role('editor')))
  with check ((select public.has_role('editor')));
create policy error_reports_delete_admin on public.error_reports
  for delete to authenticated using ((select public.has_role('admin')));

-- rate_limits: sin políticas (solo funciones security definer).
