-- ORANGE FIT · seed pendiente 10 · Catálogo inicial de alimentos (Perú y Latinoamérica).
--
-- Cargar DESPUÉS de las migraciones (supabase/migrations). Orden: 10_foods → 20_recipes → 30_reference_prices.
-- Todos los valores son por 100 g, APROXIMADOS y sin verificar: source = 'curated',
-- verification_status = 'unverified'. Ningún alimento se marca 'verified' desde aquí.
-- Procedencia de cada fila en source_ref / source_url / license. Detalle y flujo de revisión en
-- docs/DATA_SOURCES.md. Los platos (food_type 'dish') se estimaron con una receta estándar armada con
-- los alimentos de este mismo archivo (composición en docs/DATA_SOURCES.md).
-- name_normalized lo recalcula el trigger foods_set_search_fields con public.normalize_text(name);
-- aquí se envía el mismo valor para que el archivo se lea solo.
-- No es idempotente: si ya se cargó, el bloque de guarda aborta sin escribir nada.
-- Generado por un script; 196 alimentos, 276 porciones.

begin;

do $$
begin
  if exists (select 1 from public.foods where created_by is null and name_normalized = 'arroz blanco cocido') then
    raise exception 'seed-pending/10_foods.sql ya fue cargado (existe "arroz blanco cocido"). No se escribió nada.';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------------------------
-- Cereales, granos y panes (20)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Arroz blanco cocido', 'arroz blanco cocido', 'Grano largo cocido en agua, sin sal ni aceite.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 130, 2.69, 28.17, 0.28, 0.4, 0.05, 0.08, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Rice, white, long-grain, regular, enriched, cooked" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Arroz blanco crudo', 'arroz blanco crudo', 'Peso en crudo, tal como se compra.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 365, 7.13, 79.95, 0.66, 1.3, 0.12, 0.18, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Rice, white, long-grain, regular, raw, enriched" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Arroz integral cocido', 'arroz integral cocido', 'Cocido en agua, sin sal ni aceite.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 111, 2.58, 22.96, 0.9, 1.8, 0.35, 0.18, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Rice, brown, long-grain, cooked" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Arroz integral crudo', 'arroz integral crudo', 'Peso en crudo, tal como se compra.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 367, 7.54, 76.17, 3.2, 3.6, null, 0.64, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Rice, brown, long-grain, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Quinua cocida', 'quinua cocida', 'Lavada y cocida en agua, sin sal.', 'generic', '{PE,BO,EC}', 120, 4.4, 21.3, 1.92, 2.8, 0.87, 0.23, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Quinoa, cooked" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Quinua cruda', 'quinua cruda', 'Grano seco, peso en crudo.', 'generic', '{PE,BO,EC}', 368, 14.12, 64.16, 6.07, 7, null, 0.71, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Quinoa, uncooked" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Kiwicha cocida', 'kiwicha cocida', 'Grano de kiwicha cocido en agua, sin sal.', 'generic', '{PE,BO,EC}', 102, 3.8, 18.69, 1.58, 2.1, null, null, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Amaranth grain, cooked" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Avena en hojuelas', 'avena en hojuelas', 'Cruda, tal como viene en la bolsa. Puede tener trazas de gluten.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 379, 13.15, 67.7, 6.52, 10.1, 0.99, 1.11, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cereals, oats, regular and quick, not fortified, dry" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Avena cocida en agua', 'avena cocida en agua', 'Avena cocida solo con agua, sin azúcar ni leche.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 71, 2.54, 12, 1.52, 1.7, 0.27, 0.31, 4, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cereals, oats, regular and quick, unenriched, cooked with water, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pan francés', 'pan frances', 'Pan de panadería de corteza dura.', 'generic', '{PE}', 293, 9.86, 52.7, 4.3, 2.3, null, null, 544, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Rolls, hard (includes kaiser)": pan de corteza dura similar al pan francés peruano — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pan de molde blanco', 'pan de molde blanco', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 266, 7.64, 50.61, 3.29, 2.4, 5.34, 0.72, 491, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Bread, white, commercially prepared (includes soft bread crumbs)" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pan de molde integral', 'pan de molde integral', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 252, 12.45, 42.71, 3.5, 6, 4.41, null, 450, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Bread, whole-wheat, commercially prepared" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Fideos cocidos', 'fideos cocidos', 'Tallarín o spaghetti cocido en agua sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 158, 5.8, 30.86, 0.93, 1.8, 0.56, 0.18, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Pasta, cooked, enriched, without added salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Fideos secos', 'fideos secos', 'Tallarín, spaghetti o fideo corto, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 371, 13.04, 74.67, 1.51, 3.2, 2.67, 0.28, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Pasta, dry, enriched" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Choclo cocido', 'choclo cocido', 'Granos de choclo sancochado, sin sal.', 'generic', '{PE,BO,EC}', 96, 3.41, 20.98, 1.5, 2.4, 4.54, 0.2, 1, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Corn, sweet, yellow, cooked, boiled, drained, without salt": el choclo andino tiene más almidón y menos azúcar que el maíz dulce — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Cancha tostada', 'cancha tostada', 'Maíz cancha tostado. El sodio depende de la sal que se agregue.', 'generic', '{PE}', 400, 9.5, 74, 8, 7, null, null, null, null,
   'curated', 'Estimación propia aproximada (maíz cancha tostado con poco aceite; base USDA "Corn grain, yellow" con menos agua y aceite añadido; la sal varía); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Harina de trigo', 'harina de trigo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 364, 10.33, 76.31, 0.98, 2.7, 0.27, 0.16, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Wheat flour, white, all-purpose, enriched, bleached" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Harina de maíz amarillo', 'harina de maiz amarillo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 362, 8.12, 76.89, 3.59, 7.3, 0.64, 0.51, 35, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cornmeal, whole-grain, yellow" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Maicena (almidón de maíz)', 'maicena (almidon de maiz)', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 381, 0.26, 91.27, 0.05, 0.9, 0, 0.01, 9, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cornstarch" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Galletas de soda', 'galletas de soda', 'Galleta salada tipo soda. El sodio varía por marca.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 421, 9.46, 74.05, 8.64, 2.8, 1.31, null, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Crackers, saltines (includes oyster, soda, soup)" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Tubérculos y raíces (12)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Papa blanca cruda', 'papa blanca cruda', 'Papa canchán, yungay o similar, cruda (peso para cocinar).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 77, 2.05, 17.49, 0.09, 2.1, 0.82, 0.03, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Potatoes, flesh and skin, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Papa blanca sancochada', 'papa blanca sancochada', 'Cocida y pelada, sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 86, 1.71, 20.01, 0.1, 2, 0.85, 0.03, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Potatoes, boiled, cooked without skin, flesh, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Papa amarilla sancochada', 'papa amarilla sancochada', 'Cocida y pelada, sin sal.', 'generic', '{PE}', 101, 2.2, 23, 0.2, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (papa amarilla (Solanum goniocalyx), con más materia seca que la papa blanca); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Papa huayro sancochada', 'papa huayro sancochada', 'Cocida con o sin cáscara, sin sal.', 'generic', '{PE}', 96, 2.1, 21.8, 0.2, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (papa nativa harinosa, valor intermedio entre papa blanca y amarilla); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Camote sancochado', 'camote sancochado', 'Camote amarillo o morado, cocido y pelado.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 76, 1.37, 17.72, 0.14, 2.5, 5.74, 0.03, 27, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Sweet potato, cooked, boiled, without skin" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Yuca cruda', 'yuca cruda', 'Pelada, cruda (peso para cocinar).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 160, 1.36, 38.06, 0.28, 1.8, 1.7, 0.07, 14, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cassava, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Yuca sancochada', 'yuca sancochada', 'Cocida en agua, sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 125, 0.6, 30.1, 0.3, 1.6, null, null, null, null,
   'curated', 'Valor aproximado basado en TACO 4.ª ed. (NEPA-UNICAMP, Brasil), "Mandioca, cozida" — pendiente de verificar contra la fuente', null, 'Uso con cita de la fuente (TACO, NEPA-UNICAMP)', 'unverified', null, true),
  ('Olluco', 'olluco', 'Crudo, en tiras para guisar.', 'generic', '{PE,BO,EC}', 59, 1.1, 13.3, 0.1, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (tubérculo andino Ullucus tuberosus, crudo); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Oca', 'oca', 'Cruda, con cáscara.', 'generic', '{PE,BO,EC}', 62, 1, 13.8, 0.3, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (tubérculo andino Oxalis tuberosa, crudo); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Chuño seco', 'chuno seco', 'Peso en seco, antes de remojar.', 'generic', '{PE,BO,EC}', 330, 2, 79, 0.2, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (papa deshidratada por congelamiento; casi todo es almidón); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Papa seca', 'papa seca', 'Peso en seco, antes de remojar.', 'generic', '{PE}', 354, 8.34, 81.17, 0.41, 6.6, null, null, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Potatoes, mashed, dehydrated, flakes without milk, dry form": papa cocida y deshidratada; composición análoga a hojuelas de papa deshidratada — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Papas fritas', 'papas fritas', 'Papas fritas en aceite vegetal, con sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 312, 3.43, 41.44, 14.73, 3.8, 0.3, 2.33, 210, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fast foods, potato, french fried in vegetable oil" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Menestras (12)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Lentejas cocidas', 'lentejas cocidas', 'Cocidas en agua, sin sal ni aderezo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 116, 9.02, 20.13, 0.38, 7.9, 1.8, 0.05, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Lentils, mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Lentejas secas', 'lentejas secas', 'Peso en seco, antes de cocinar.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 352, 24.63, 63.35, 1.06, 10.7, 2.03, 0.15, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Lentils, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Frejol canario cocido', 'frejol canario cocido', 'Cocido en agua, sin sal ni aderezo.', 'generic', '{PE}', 144, 9.16, 25.27, 1.08, 10.4, null, 0.28, 5, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beans, yellow, mature seeds, cooked, boiled, without salt": el frejol canario es un frejol amarillo — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Frejol canario seco', 'frejol canario seco', 'Peso en seco, antes de remojar.', 'generic', '{PE}', 345, 22, 60.7, 2.6, 25.1, null, null, 12, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beans, yellow, mature seeds, raw": el frejol canario es un frejol amarillo — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Garbanzos cocidos', 'garbanzos cocidos', 'Cocidos en agua, sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 164, 8.86, 27.42, 2.59, 7.6, 4.8, 0.27, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Garbanzos secos', 'garbanzos secos', 'Peso en seco, antes de remojar.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 378, 20.47, 62.95, 6.04, 12.2, 10.7, 0.6, 24, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Chickpeas (garbanzo beans, bengal gram), mature seeds, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pallares cocidos', 'pallares cocidos', 'Cocidos en agua, sin sal.', 'generic', '{PE}', 115, 7.8, 20.88, 0.38, 7, 2.9, 0.09, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Lima beans, large, mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Habas secas cocidas', 'habas secas cocidas', 'Haba seca cocida, sin sal.', 'generic', '{PE,BO,EC}', 110, 7.6, 19.65, 0.4, 5.4, 1.82, 0.07, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Broadbeans (fava beans), mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Habas verdes cocidas', 'habas verdes cocidas', 'Haba tierna desgranada y sancochada, sin sal.', 'generic', '{PE,BO,EC}', 62, 4.8, 10.1, 0.5, null, null, null, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Broadbeans, immature seeds, cooked, boiled, drained, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Arvejas verdes cocidas', 'arvejas verdes cocidas', 'Arveja fresca desgranada, cocida sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 84, 5.36, 15.63, 0.22, 5.5, 5.93, 0.04, 3, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Peas, green, cooked, boiled, drained, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Arveja partida cocida', 'arveja partida cocida', 'Cocida en agua, sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 118, 8.34, 21.1, 0.39, 8.3, 2.9, 0.05, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Peas, split, mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Frejol negro cocido', 'frejol negro cocido', 'Cocido en agua, sin sal.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 132, 8.86, 23.71, 0.54, 8.7, 0.32, 0.14, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beans, black, mature seeds, cooked, boiled, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Carnes y aves (16)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Pechuga de pollo sin piel, cruda', 'pechuga de pollo sin piel, cruda', 'Filete sin piel ni hueso, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 120, 22.5, 0, 2.62, 0, 0, 0.56, 45, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Chicken, broilers or fryers, breast, meat only, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pechuga de pollo sin piel, a la plancha', 'pechuga de pollo sin piel, a la plancha', 'Cocida sin piel y sin aceite añadido.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 165, 31.02, 0, 3.57, 0, 0, 1.01, 74, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Chicken, broilers or fryers, breast, meat only, cooked, roasted" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pierna de pollo sin piel, cruda', 'pierna de pollo sin piel, cruda', 'Solo carne, sin piel ni hueso.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 120, 19.2, 0, 3.8, 0, 0, 1, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Chicken, broilers or fryers, leg, meat only, raw": valor redondeado (encuentro + muslo, solo carne) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pierna de pollo sin piel, cocida', 'pierna de pollo sin piel, cocida', 'Solo carne, sin piel ni hueso.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 191, 27, 0, 8.4, 0, 0, 2.3, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Chicken, broilers or fryers, leg, meat only, cooked, roasted": valor redondeado (encuentro + muslo, solo carne) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pollo con piel, asado', 'pollo con piel, asado', 'Carne y piel, sin hueso, sin sal añadida.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 239, 27.3, 0, 13.6, 0, 0, 3.79, 82, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Chicken, broilers or fryers, meat and skin, cooked, roasted" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Carne de res magra, cruda', 'carne de res magra, cruda', 'Bistec o trozos sin grasa visible, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 125, 22, 0, 4, 0, 0, 1.5, 55, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beef, round, top round, separable lean only, raw": valor redondeado para cortes magros (tapa, cadera, pierna) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Carne de res magra, a la plancha', 'carne de res magra, a la plancha', 'Cocida sin aceite añadido.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 185, 29, 0, 7.5, 0, 0, 2.9, 60, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beef, round, top round, separable lean only, cooked, broiled": valor redondeado para cortes magros — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Lomo fino de res, crudo', 'lomo fino de res, crudo', 'Lomo fino sin grasa visible, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 143, 21, 0, 6.5, 0, 0, 2.5, 55, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beef, tenderloin, steak, separable lean only, trimmed to 0" fat, raw": valor redondeado — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Carne molida de res 90 % magra, cruda', 'carne molida de res 90 % magra, cruda', 'Molida especial (baja en grasa), peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 176, 20, 0, 10, 0, 0, 3.94, 66, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beef, ground, 90% lean meat / 10% fat, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Carne molida de res 80 % magra, cruda', 'carne molida de res 80 % magra, cruda', 'Molida regular, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 254, 17.17, 0, 20, 0, 0, 7.58, 66, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beef, ground, 80% lean meat / 20% fat, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Lomo de cerdo, crudo', 'lomo de cerdo, crudo', 'Sin grasa visible, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 120, 20.95, 0, 3.39, 0, 0, 1.17, 53, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Pork, fresh, loin, tenderloin, separable lean only, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pierna de cerdo, cruda', 'pierna de cerdo, cruda', 'Carne con su grasa, peso en crudo (base de chicharrón y adobo).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 245, 17.43, 0, 18.87, 0, 0, null, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Pork, fresh, leg (ham), whole, separable lean and fat, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Hígado de res, crudo', 'higado de res, crudo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 135, 20.36, 3.89, 3.63, 0, 0, 1.23, 69, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beef, variety meats and by-products, liver, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pechuga de pavo, cruda', 'pechuga de pavo, cruda', 'Sin piel ni hueso, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 112, 24, 0, 1, 0, 0, null, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Turkey breast, meat only, raw": valor redondeado para pechuga de pavo sin piel — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Corazón de res, crudo', 'corazon de res, crudo', 'Limpio, peso en crudo (base de anticuchos).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 112, 17.72, 0.14, 3.94, 0, null, 1.38, 98, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beef, variety meats and by-products, heart, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Salchicha de hot dog', 'salchicha de hot dog', 'Salchicha de pollo tipo hot dog. El sodio varía por marca.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 223, 15.51, 2.74, 16.19, 0, null, null, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Frankfurter, chicken": salchicha tipo hot dog de pollo; varía mucho por marca — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Pescados y mariscos (15)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Bonito, crudo', 'bonito, crudo', 'Parte comestible, peso en crudo.', 'generic', '{PE}', 138, 23, 0, 5, 0, 0, null, null, null,
   'curated', 'Estimación propia aproximada (Sarda chiliensis, filete crudo; valor intermedio entre atunes y caballas); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Jurel, crudo', 'jurel, crudo', 'Parte comestible, peso en crudo.', 'generic', '{PE}', 158, 20.07, 0, 7.89, 0, 0, 2.25, 86, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Fish, mackerel, Pacific and jack, mixed species, raw": Trachurus murphyi — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Caballa, cruda', 'caballa, cruda', 'Parte comestible, peso en crudo.', 'generic', '{PE}', 158, 20.07, 0, 7.89, 0, 0, 2.25, 86, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Fish, mackerel, Pacific and jack, mixed species, raw": Scomber japonicus — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Perico (dorado), crudo', 'perico (dorado), crudo', 'Filete sin piel, peso en crudo.', 'generic', '{PE}', 85, 18.5, 0, 0.7, 0, 0, 0.19, 88, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, mahimahi, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Tilapia, cruda', 'tilapia, cruda', 'Filete, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 96, 20.08, 0, 1.7, 0, 0, 0.59, 52, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, tilapia, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Trucha, cruda', 'trucha, cruda', 'Filete de trucha de piscigranja, peso en crudo.', 'generic', '{PE,BO,EC}', 141, 20.77, 0, 6.18, 0, 0, 1.81, 51, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, trout, rainbow, farmed, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Merluza, cruda', 'merluza, cruda', 'Filete, peso en crudo.', 'generic', '{PE}', 90, 18.31, 0, 1.31, 0, 0, null, 72, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Fish, whiting, mixed species, raw": pescado blanco magro análogo a la merluza peruana — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Atún en agua, escurrido', 'atun en agua, escurrido', 'Atún en conserva, sin el líquido. El sodio varía por marca.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 116, 25.51, 0, 0.82, 0, 0, 0.23, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, tuna, light, canned in water, drained solids" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Atún en aceite, escurrido', 'atun en aceite, escurrido', 'Atún en conserva, sin el aceite. El sodio varía por marca.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 198, 29.13, 0, 8.21, 0, 0, 1.53, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, tuna, light, canned in oil, drained solids" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Sardinas en aceite, escurridas', 'sardinas en aceite, escurridas', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 208, 24.62, 0, 11.45, 0, 0, 1.53, 307, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Fish, sardine, Atlantic, canned in oil, drained solids with bone" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pota, cruda', 'pota, cruda', 'Limpia, peso en crudo.', 'generic', '{PE}', 92, 15.58, 3.08, 1.38, 0, 0, 0.36, 44, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Mollusks, squid, mixed species, raw": calamar gigante Dosidicus gigas — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Langostinos, crudos', 'langostinos, crudos', 'Pelados, sin cabeza, peso en crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 85, 20.1, 0, 0.51, 0, 0, null, 119, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Crustaceans, shrimp, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Conchas negras, crudas', 'conchas negras, crudas', 'Solo la carne con su jugo.', 'generic', '{PE}', 74, 12.77, 2.57, 0.97, 0, null, null, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Mollusks, clam, mixed species, raw": Anadara tuberculosa — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Conchas de abanico, crudas', 'conchas de abanico, crudas', 'Carne con coral, sin valva.', 'generic', '{PE}', 69, 12.06, 3.18, 0.49, 0, null, null, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Mollusks, scallop, mixed species, raw": Argopecten purpuratus — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Choros (mejillones), crudos', 'choros (mejillones), crudos', 'Solo la carne.', 'generic', '{PE}', 86, 11.9, 3.69, 2.24, 0, null, 0.43, 286, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Mollusks, mussel, blue, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Huevos (5)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Huevo de gallina', 'huevo de gallina', 'Entero, sin cáscara, crudo.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 143, 12.56, 0.72, 9.51, 0, 0.37, 3.13, 142, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Egg, whole, raw, fresh" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Huevo sancochado', 'huevo sancochado', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 155, 12.58, 1.12, 10.61, 0, 1.12, 3.27, 124, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Egg, whole, cooked, hard-boiled" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Huevo frito', 'huevo frito', 'Frito con un poco de aceite.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 196, 13.61, 0.83, 14.84, 0, null, null, 207, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Egg, whole, cooked, fried" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Clara de huevo', 'clara de huevo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 52, 10.9, 0.73, 0.17, 0, 0.71, 0, 166, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Egg, white, raw, fresh" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Huevo de codorniz', 'huevo de codorniz', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 158, 13.05, 0.41, 11.09, 0, null, 3.56, 141, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Egg, quail, whole, fresh, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Lácteos y alternativas (12)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Leche entera', 'leche entera', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 61, 3.15, 4.8, 3.25, 0, 4.8, 1.87, 43, 1.03,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Milk, whole, 3.25% milkfat, with added vitamin D" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Leche descremada', 'leche descremada', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 34, 3.37, 4.96, 0.08, 0, 4.96, 0.06, 42, 1.035,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Leche evaporada entera', 'leche evaporada entera', 'Sin diluir, tal como sale de la lata.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 134, 6.81, 10.04, 7.56, 0, 10.04, 4.59, 106, 1.07,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Milk, canned, evaporated, without added vitamin A" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Leche evaporada descremada', 'leche evaporada descremada', 'Evaporada light sin diluir. Algunas marcas tienen algo más de grasa.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 78, 7.55, 11.35, 0.2, 0, 11.35, 0.12, 115, 1.07,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Milk, canned, evaporated, nonfat, with added vitamin A and vitamin D" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Yogurt natural sin azúcar', 'yogurt natural sin azucar', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 61, 3.47, 4.66, 3.25, 0, 4.66, 2.1, 46, 1.04,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Yogurt, plain, whole milk" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Yogurt griego natural sin grasa', 'yogurt griego natural sin grasa', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 59, 10.19, 3.6, 0.39, 0, 3.24, 0.12, 36, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Yogurt, Greek, plain, nonfat" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Queso fresco', 'queso fresco', 'Queso fresco de vaca. La sal varía mucho por marca.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 299, 18.09, 2.98, 23.82, 0, 2.32, 12.94, 751, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cheese, fresh, queso fresco" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Queso andino', 'queso andino', null, 'generic', '{PE}', 356, 24.94, 2.22, 27.44, 0, 2.22, 17.61, 819, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Cheese, gouda": queso semimaduro análogo al queso andino o paria — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Leche condensada', 'leche condensada', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 321, 7.91, 54.4, 8.7, 0, 54.4, 5.49, 127, 1.3,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Milk, canned, condensed, sweetened" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Manjar blanco', 'manjar blanco', null, 'generic', '{PE}', 315, 6.84, 55.35, 7.35, 0, 49.74, null, 129, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Dulce de leche": manjar blanco peruano análogo al dulce de leche — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Mantequilla con sal', 'mantequilla con sal', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 717, 0.85, 0.06, 81.11, 0, 0.06, 51.37, 643, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Butter, salted" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Tofu', 'tofu', 'Tofu regular (no extra firme).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 76, 8.08, 1.87, 4.78, 0.3, null, 0.69, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Tofu, raw, regular, prepared with calcium sulfate" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Frutas (23)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Plátano de seda', 'platano de seda', 'Pulpa, sin cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 89, 1.09, 22.84, 0.33, 2.6, 12.23, 0.11, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Bananas, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Plátano de isla', 'platano de isla', 'Pulpa, sin cáscara.', 'generic', '{PE}', 89, 1.09, 22.84, 0.33, 2.6, 12.23, 0.11, 1, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Bananas, raw": variedad pequeña peruana; se usó el valor general del plátano — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Manzana', 'manzana', 'Con cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 52, 0.26, 13.81, 0.17, 2.4, 10.39, 0.03, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Apples, raw, with skin" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Papaya', 'papaya', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 43, 0.47, 10.82, 0.26, 1.7, 7.82, 0.08, 8, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Papayas, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Mango', 'mango', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 60, 0.82, 14.98, 0.38, 1.6, 13.66, 0.09, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Mangos, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Piña', 'pina', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 50, 0.54, 13.12, 0.12, 1.4, 9.85, 0.01, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Pineapple, raw, all varieties" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Naranja', 'naranja', 'Pulpa, sin cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 47, 0.94, 11.75, 0.12, 2.4, 9.35, 0.02, 0, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Oranges, raw, all commercial varieties" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Mandarina', 'mandarina', 'Pulpa, sin cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 53, 0.81, 13.34, 0.31, 1.8, 10.58, 0.04, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Tangerines, (mandarin oranges), raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Lúcuma', 'lucuma', 'Pulpa fresca, sin cáscara ni pepa.', 'generic', '{PE,BO,EC}', 99, 1.5, 25, 0.5, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (pulpa fresca de Pouteria lucuma); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Chirimoya', 'chirimoya', 'Pulpa, sin pepas.', 'generic', '{PE,BO,EC}', 75, 1.57, 17.71, 0.68, 3, 12.94, 0.23, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cherimoya, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Aguaymanto', 'aguaymanto', null, 'generic', '{PE,BO,EC}', 53, 1.9, 11.2, 0.7, null, null, null, null, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Groundcherries, (cape-gooseberries or poha), raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Granadilla', 'granadilla', 'Pulpa con pepas.', 'generic', '{PE,BO,EC}', 97, 2.2, 23.38, 0.7, 10.4, 11.2, 0.06, 28, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Passion-fruit, (granadilla), purple, raw": Passiflora ligularis; se usó el maracuyá morado como análogo — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Maracuyá, pulpa colada', 'maracuya, pulpa colada', 'Pulpa colada sin agua ni azúcar.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 60, 0.67, 14.45, 0.18, 0.2, 14.25, 0.02, 6, 1.05,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Passion-fruit juice, yellow, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Camu camu, pulpa', 'camu camu, pulpa', 'Pulpa sin azúcar.', 'generic', '{PE}', 24, 0.4, 5.9, 0.2, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (pulpa de Myrciaria dubia, muy ácida y baja en azúcar); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Palta', 'palta', 'Pulpa, sin cáscara ni pepa.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 160, 2, 8.53, 14.66, 6.7, 0.66, 2.13, 7, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Avocados, raw, all commercial varieties" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Fresa', 'fresa', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 32, 0.67, 7.68, 0.3, 2, 4.89, 0.02, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Strawberries, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Uva', 'uva', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 69, 0.72, 18.1, 0.16, 0.9, 15.48, 0.05, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Grapes, red or green (European type, such as Thompson seedless), raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Sandía', 'sandia', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 30, 0.61, 7.55, 0.15, 0.4, 6.2, 0.02, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Watermelon, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Melón', 'melon', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 34, 0.84, 8.16, 0.19, 0.9, 7.86, 0.05, 16, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Melons, cantaloupe, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Tuna (fruta)', 'tuna (fruta)', 'Pulpa de tuna, sin cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 41, 0.73, 9.57, 0.51, 3.6, null, 0.07, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Prickly pears, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pasas', 'pasas', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 299, 3.07, 79.18, 0.46, 3.7, 59.19, 0.06, 11, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Raisins, seedless" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Limón, jugo', 'limon, jugo', 'Jugo de limón sutil recién exprimido.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 25, 0.42, 8.42, 0.07, 0.4, 1.69, 0.01, 2, 1.03,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Lime juice, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Aceituna de botija', 'aceituna de botija', 'Sin pepa. El sodio no está registrado porque varía mucho.', 'generic', '{PE}', 115, 0.84, 6.04, 10.68, 1.6, 0, 1.42, null, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Olives, ripe, canned (small-extra large)": aceituna negra en salmuera; la botija suele ser más salada, por eso el sodio queda sin valor — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Verduras y hortalizas (24)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Lechuga', 'lechuga', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 15, 1.36, 2.87, 0.15, 1.3, 0.78, 0.02, 28, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Lettuce, green leaf, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Tomate', 'tomate', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 18, 0.88, 3.89, 0.2, 1.2, 2.63, 0.03, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Tomatoes, red, ripe, raw, year round average" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Cebolla roja', 'cebolla roja', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 40, 1.1, 9.34, 0.1, 1.7, 4.24, 0.04, 4, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Onions, raw": cebolla roja peruana — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Cebolla china', 'cebolla china', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 32, 1.83, 7.34, 0.19, 2.6, 2.33, 0.03, 16, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Onions, spring or scallions (includes tops and bulb), raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Ajo', 'ajo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 149, 6.36, 33.06, 0.5, 2.1, 1, 0.09, 17, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Garlic, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Zanahoria', 'zanahoria', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 41, 0.93, 9.58, 0.24, 2.8, 4.74, 0.04, 69, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Carrots, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Brócoli', 'brocoli', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 34, 2.82, 6.64, 0.37, 2.6, 1.7, 0.04, 33, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Broccoli, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Espinaca', 'espinaca', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 23, 2.86, 3.63, 0.39, 2.2, 0.42, 0.06, 79, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Spinach, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Zapallo macre', 'zapallo macre', 'Pulpa sin cáscara.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 26, 1, 6.5, 0.1, 0.5, 2.76, 0.05, 1, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Pumpkin, raw": zapallo macre o loche — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Zapallito italiano', 'zapallito italiano', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 17, 1.21, 3.11, 0.32, 1, 2.5, 0.08, 8, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Squash, summer, zucchini, includes skin, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Vainita', 'vainita', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 31, 1.83, 6.97, 0.22, 2.7, 3.26, 0.05, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beans, snap, green, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pepino', 'pepino', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 15, 0.65, 3.63, 0.11, 0.5, 1.67, 0.04, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cucumber, with peel, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Beterraga sancochada', 'beterraga sancochada', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 44, 1.68, 9.96, 0.18, 2, 7.96, 0.03, 77, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beets, cooked, boiled, drained" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Ají amarillo', 'aji amarillo', 'Fresco, sin venas ni pepas.', 'generic', '{PE}', 40, 1.87, 8.81, 0.44, 1.5, 5.3, 0.04, 9, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Peppers, hot chili, red, raw": ají amarillo fresco (Capsicum baccatum) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Rocoto', 'rocoto', 'Fresco, sin venas ni pepas.', 'generic', '{PE}', 40, 2, 9.46, 0.2, 1.5, 5.1, null, 7, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Peppers, hot chili, green, raw": rocoto (Capsicum pubescens) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Ají panca seco', 'aji panca seco', 'Seco, sin pepas (antes de remojar).', 'generic', '{PE}', 281, 11.86, 51.42, 8.2, 21.6, null, null, 43, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Peppers, ancho, dried": ají seco análogo; el ají panca es Capsicum chinense — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Pimiento rojo', 'pimiento rojo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 31, 0.99, 6.03, 0.3, 2.1, 4.2, 0.03, 4, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Peppers, sweet, red, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Coliflor', 'coliflor', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 25, 1.92, 4.97, 0.28, 2, 1.91, 0.13, 30, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cauliflower, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Repollo', 'repollo', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 25, 1.28, 5.8, 0.1, 2.5, 3.2, 0.03, 18, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Cabbage, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Apio', 'apio', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 16, 0.69, 2.97, 0.17, 1.6, 1.34, 0.04, 80, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Celery, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Culantro', 'culantro', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 23, 2.13, 3.67, 0.52, 2.8, 0.87, 0.01, 46, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Coriander (cilantro) leaves, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Albahaca', 'albahaca', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 23, 3.15, 2.65, 0.64, 1.6, 0.3, 0.04, 4, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Basil, fresh" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Champiñones', 'champinones', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 22, 3.09, 3.26, 0.34, 1, 1.98, 0.05, 5, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Mushrooms, white, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Kion (jengibre)', 'kion (jengibre)', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 80, 1.82, 17.77, 0.75, 2, 1.7, 0.2, 13, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Ginger root, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Grasas, frutos secos y semillas (10)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Aceite vegetal', 'aceite vegetal', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 884, 0, 0, 100, 0, 0, 15.65, 0, 0.92,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Oil, soybean, salad or cooking": aceite vegetal comercial (soya, girasol o mezcla) — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Aceite de oliva', 'aceite de oliva', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 884, 0, 0, 100, 0, 0, 13.81, 2, 0.91,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Oil, olive, salad or cooking" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Mayonesa', 'mayonesa', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 680, 0.96, 0.57, 74.85, 0, 0.57, 11.74, 635, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Salad dressing, mayonnaise, regular" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Maní tostado sin sal', 'mani tostado sin sal', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 585, 23.68, 21.51, 49.66, 8, null, 6.89, 6, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Peanuts, all types, dry-roasted, without salt" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Mantequilla de maní', 'mantequilla de mani', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 588, 25.09, 19.56, 50.39, 6, null, null, 17, null,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Peanut butter, smooth style, without salt": mantequilla de maní natural, sin azúcar añadida — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Sacha inchi tostado', 'sacha inchi tostado', null, 'generic', '{PE}', 590, 27, 13, 48, null, null, null, null, null,
   'curated', 'Estimación propia aproximada (semillas tostadas de Plukenetia volubilis; rangos publicados de proteína y grasa); sin valor de tabla confirmado — pendiente de verificar contra las Tablas Peruanas de Composición de Alimentos (CENAN/INS 2017)', null, null, 'unverified', null, true),
  ('Almendras', 'almendras', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 579, 21.15, 21.55, 49.93, 12.5, 4.35, 3.8, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Nuts, almonds" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Nueces', 'nueces', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 654, 15.23, 13.71, 65.21, 6.7, 2.61, 6.13, 2, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Nuts, walnuts, english" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Chía', 'chia', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 486, 16.54, 42.12, 30.74, 34.4, null, 3.33, 16, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Seeds, chia seeds, dried" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Linaza', 'linaza', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 534, 18.29, 28.88, 42.16, 27.3, 1.55, 3.66, 30, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Seeds, flaxseed" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Azúcares, condimentos y otros (7)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Azúcar blanca', 'azucar blanca', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 387, 0, 99.98, 0, 0, 99.8, 0, 1, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Sugars, granulated" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Azúcar rubia', 'azucar rubia', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 380, 0.12, 98.09, 0, 0, 97.02, 0, 28, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Sugars, brown" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Miel de abeja', 'miel de abeja', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 304, 0.3, 82.4, 0, 0.2, 82.12, 0, 4, 1.42,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Honey" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Sal de mesa', 'sal de mesa', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 0, 0, 0, 0, 0, 0, 0, 38758, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Salt, table" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Sillao (salsa de soya)', 'sillao (salsa de soya)', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 53, 8.14, 4.93, 0.57, 0.8, 0.4, 0.07, 5493, null,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Soy sauce made from soy and wheat (shoyu)" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Vinagre', 'vinagre', null, 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 18, 0, 0.04, 0, 0, 0.04, 0, 2, 1.01,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Vinegar, distilled" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Café pasado', 'cafe pasado', 'Sin azúcar ni leche.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 1, 0.12, 0, 0.02, 0, 0, 0, 2, 1,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Beverages, coffee, brewed, prepared with tap water" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Bebidas (3)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Gaseosa regular', 'gaseosa regular', 'Con azúcar (no light ni zero).', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 37, 0, 9.56, 0, 0, 8.97, 0, 4, 1.04,
   'curated', 'Aproximación con un alimento análogo de USDA FoodData Central (SR Legacy), "Beverages, carbonated, cola, contains caffeine": gaseosa con azúcar; varía por marca y sabor — pendiente de verificar contra TPCA (CENAN/INS 2017)', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Cerveza', 'cerveza', 'Cerveza regular; parte de la energía viene del alcohol.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 43, 0.46, 3.55, 0, 0, 0, 0, 4, 1.01,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Alcoholic beverage, beer, regular, all" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true),
  ('Jugo de naranja natural', 'jugo de naranja natural', 'Recién exprimido, sin azúcar.', 'generic', '{PE,BO,CL,CO,EC,MX,AR}', 45, 0.7, 10.4, 0.2, 0.2, 8.4, 0.02, 1, 1.04,
   'curated', 'Valor aproximado basado en USDA FoodData Central (SR Legacy), "Orange juice, raw" — pendiente de verificar contra la fuente', 'https://fdc.nal.usda.gov/', 'Dominio público (USDA FoodData Central, CC0 1.0)', 'unverified', null, true);

-- -----------------------------------------------------------------------------------------------
-- Platos y preparaciones peruanas (37)
-- -----------------------------------------------------------------------------------------------
insert into public.foods (name, name_normalized, description, food_type, country_codes, energy_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, saturated_fat_g, sodium_mg, density_g_per_ml, source, source_ref, source_url, license, verification_status, created_by, is_public)
values
  ('Arroz blanco graneado', 'arroz blanco graneado', 'Arroz cocido al estilo casero peruano, con aceite, ajo y sal.', 'dish', '{PE}', 147, 2.6, 28.4, 2.1, 0.5, 0, 0.4, 260, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Ceviche de pescado', 'ceviche de pescado', 'Solo el ceviche: pescado, limón, cebolla, rocoto y culantro. Sin camote ni choclo (regístralos aparte).', 'dish', '{PE}', 63, 10.9, 3.8, 0.4, 0.5, 1.3, 0.1, 404, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Lomo saltado', 'lomo saltado', 'Con papas fritas, sin arroz.', 'dish', '{PE}', 166, 8.5, 14.7, 8.3, 1.7, 1.8, 1.8, 364, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Pollo a la brasa con piel', 'pollo a la brasa con piel', 'Solo el pollo con piel, sin papas ni ensalada.', 'dish', '{PE}', 235, 26.9, 0.1, 13.3, 0, 0, 3.7, 389, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Ají de gallina', 'aji de gallina', 'Guiso cremoso de pollo deshilachado con ají amarillo; sin arroz ni papa.', 'dish', '{PE}', 171, 15.2, 8.2, 8.5, 0.7, 3.2, 2.5, 294, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Causa limeña de pollo', 'causa limena de pollo', 'Papa amarilla con ají y limón, rellena de pollo con mayonesa y palta.', 'dish', '{PE}', 163, 7, 13.7, 9.1, null, null, 1.5, null, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Arroz con pollo', 'arroz con pollo', 'Plato completo: arroz verde con presa de pollo, arvejas, zanahoria y choclo.', 'dish', '{PE}', 149, 8.7, 16.5, 5.2, 1.1, 1.3, 1.2, 186, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Seco de res', 'seco de res', 'Guiso de res con culantro, arvejas, zanahoria y papa; sin arroz ni frejoles.', 'dish', '{PE}', 108, 10.6, 7.2, 4.2, 1.5, 1.8, 1, 269, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Tacu tacu', 'tacu tacu', 'Arroz y frejol canario refritos, sin acompañamientos.', 'dish', '{PE}', 165, 5.4, 24.9, 5, 5, null, 0.9, 208, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Anticuchos de corazón', 'anticuchos de corazon', 'Brochetas de corazón de res a la parrilla, sin papa ni choclo.', 'dish', '{PE}', 210, 24, 3.1, 10.8, 0.9, null, 2.6, 641, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Papa a la huancaína', 'papa a la huancaina', 'Papa sancochada con salsa huancaína, huevo y aceituna.', 'dish', '{PE}', 159, 5.2, 14.4, 9.1, 1.3, 2.2, 3.1, null, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Rocoto relleno', 'rocoto relleno', 'Rocoto relleno de carne molida, maní, huevo y queso; sin pastel de papa.', 'dish', '{PE}', 171, 8.7, 9.4, 11.5, 1.3, 5.4, 4.1, 254, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Carapulcra', 'carapulcra', 'Guiso de papa seca con cerdo, ají panca y maní; sin arroz.', 'dish', '{PE}', 151, 6.2, 13.8, 8.2, 1.6, null, null, 148, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Juane de gallina', 'juane de gallina', 'Arroz con gallina, huevo y aceituna, cocido en hoja de bijao.', 'dish', '{PE}', 180, 9.9, 18.3, 7, 0.4, 0.4, 1.7, null, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Tamal criollo', 'tamal criollo', 'Tamal de maíz con cerdo, huevo y aceituna. Aproximación: harina de maíz y aceite en lugar de maíz mote y manteca.', 'dish', '{PE}', 202, 5.4, 21, 11, 2.1, 0.3, null, null, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Humita dulce', 'humita dulce', 'Humita de choclo con mantequilla, azúcar y pasas.', 'dish', '{PE}', 172, 3.4, 27.6, 7, 2, 13.9, 3.8, 113, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Arroz chaufa de pollo', 'arroz chaufa de pollo', 'Arroz salteado con pollo, huevo, cebolla china y sillao.', 'dish', '{PE}', 157, 8.3, 19, 4.9, 0.4, 0.2, 1, 255, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Tallarines verdes', 'tallarines verdes', 'Fideos con salsa de albahaca, espinaca, queso y leche evaporada; sin bistec.', 'dish', '{PE}', 169, 6, 21.4, 6.7, 1.5, 1.7, 1.9, 184, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Sudado de pescado', 'sudado de pescado', 'Pescado cocido en jugo de tomate, cebolla y ají; sin arroz ni yuca.', 'dish', '{PE}', 101, 9.9, 3.2, 5.3, 0.7, 1.6, 1.3, 253, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Chupe de camarones', 'chupe de camarones', 'Sopa espesa con langostinos, papa, choclo, leche, queso y huevo.', 'dish', '{PE}', 80, 5.3, 8.1, 3, null, null, 1.1, 186, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Parihuela', 'parihuela', 'Sopa de pescado y mariscos con tomate y ají.', 'dish', '{PE}', 48, 6.1, 2.1, 1.7, 0.4, null, null, 184, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Caldo de gallina', 'caldo de gallina', 'Caldo con presa de gallina, fideos, papa amarilla y huevo.', 'dish', '{PE}', 75, 6, 6.1, 2.8, null, null, 0.8, 154, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Menestrón', 'menestron', 'Sopa espesa de verduras, menestras, fideos y carne con pesto de albahaca.', 'dish', '{PE}', 57, 3.2, 7.9, 1.6, 1.2, 0.9, 0.5, 131, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Adobo de cerdo', 'adobo de cerdo', 'Cerdo macerado en ají panca y vinagre, guisado; sin pan ni camote.', 'dish', '{PE}', 230, 14.7, 3.3, 17.2, 0.8, null, null, 317, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Olluquito con carne', 'olluquito con carne', 'Olluco guisado con carne de res; sin arroz.', 'dish', '{PE}', 94, 6, 10.2, 3.4, null, null, 0.7, 249, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Estofado de pollo', 'estofado de pollo', 'Pollo guisado con papa, zanahoria, arvejas y tomate; sin arroz.', 'dish', '{PE}', 92, 7.9, 8.2, 2.9, 1.6, 1.9, 0.6, 161, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Salchipapa', 'salchipapa', 'Papas fritas con salchicha frita; sin cremas.', 'dish', '{PE}', 293, 6.8, 30, 16.1, 2.7, 0.2, null, null, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Pan con chicharrón', 'pan con chicharron', 'Sánguche de chicharrón de cerdo con camote frito y sarsa criolla.', 'dish', '{PE}', 262, 13, 17.8, 15.2, 1.3, null, null, 285, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Butifarra', 'butifarra', 'Sánguche de jamón del país con sarsa criolla.', 'dish', '{PE}', 257, 14.5, 18.7, 13.4, 1.1, null, null, 380, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Picarones con miel', 'picarones con miel', 'Picarones fritos de camote y zapallo con miel de chancaca.', 'dish', '{PE}', 348, 3.4, 50.9, 15, 1.2, 25.9, 2.4, 11, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Suspiro limeño', 'suspiro limeno', 'Manjar de leches con merengue.', 'dish', '{PE}', 273, 8.3, 44, 7.6, 0, 43.9, 4.5, 127, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Mazamorra morada', 'mazamorra morada', 'Postre espeso de maíz morado con fruta; estimación sin el aporte del maíz morado (se descarta).', 'dish', '{PE}', 96, 0.1, 24.5, 0, 0.5, 17.1, 0, 1, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Arroz con leche', 'arroz con leche', 'Arroz cocido con leche evaporada, leche condensada, azúcar y pasas.', 'dish', '{PE}', 141, 3.9, 24.2, 3.3, 0.2, 13.1, 2, 46, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Alfajor de manjar blanco', 'alfajor de manjar blanco', 'Galletas de maicena rellenas de manjar blanco.', 'dish', '{PE}', 435, 5.1, 59.7, 19.6, 0.7, 28.2, null, 184, null,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Leche de tigre', 'leche de tigre', 'Jugo de ceviche con trozos de pescado; sin choclo ni cancha.', 'dish', '{PE}', 29, 3.4, 4.4, 0.2, 0.4, 1.3, 0, 394, 1.03,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Chicha morada', 'chicha morada', 'Refresco de maíz morado con piña, limón y azúcar; estimación sin el aporte del maíz morado.', 'dish', '{PE}', 46, 0, 11.9, 0, 0.1, 11.5, 0, 0, 1.04,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true),
  ('Emoliente', 'emoliente', 'Bebida caliente de hierbas con linaza, azúcar rubia y limón; no cuenta la cebada ni las hierbas (aportan poco).', 'dish', '{PE}', 34, 0.2, 7.8, 0.4, 0.3, 7.3, 0, 2, 1.02,
   'curated', 'Estimación por receta estándar — pendiente de verificación', null, null, 'unverified', null, true);

-- ===============================================================================================
-- Porciones caseras (una por defecto por alimento)
-- ===============================================================================================

-- Cereales, granos y panes
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'arroz blanco cocido' and created_by is null), '1 taza', 1, 'taza', 160, true),
  ((select id from public.foods where name_normalized = 'arroz blanco cocido' and created_by is null), '1/2 taza', 0.5, 'taza', 80, false),
  ((select id from public.foods where name_normalized = 'arroz blanco cocido' and created_by is null), '1 porción de menú', 1, 'porción', 200, false),
  ((select id from public.foods where name_normalized = 'arroz blanco crudo' and created_by is null), '1 taza', 1, 'taza', 185, true),
  ((select id from public.foods where name_normalized = 'arroz blanco crudo' and created_by is null), '1/2 taza', 0.5, 'taza', 92, false),
  ((select id from public.foods where name_normalized = 'arroz integral cocido' and created_by is null), '1 taza', 1, 'taza', 200, true),
  ((select id from public.foods where name_normalized = 'arroz integral cocido' and created_by is null), '1/2 taza', 0.5, 'taza', 100, false),
  ((select id from public.foods where name_normalized = 'arroz integral crudo' and created_by is null), '1 taza', 1, 'taza', 185, true),
  ((select id from public.foods where name_normalized = 'arroz integral crudo' and created_by is null), '1/2 taza', 0.5, 'taza', 92, false),
  ((select id from public.foods where name_normalized = 'quinua cocida' and created_by is null), '1 taza', 1, 'taza', 185, true),
  ((select id from public.foods where name_normalized = 'quinua cocida' and created_by is null), '1/2 taza', 0.5, 'taza', 92, false),
  ((select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), '1/2 taza', 0.5, 'taza', 85, true),
  ((select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), '1/4 taza', 0.25, 'taza', 42, false),
  ((select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), '1 taza', 1, 'taza', 170, false),
  ((select id from public.foods where name_normalized = 'kiwicha cocida' and created_by is null), '1 taza', 1, 'taza', 246, true),
  ((select id from public.foods where name_normalized = 'kiwicha cocida' and created_by is null), '1/2 taza', 0.5, 'taza', 123, false),
  ((select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), '1/2 taza', 0.5, 'taza', 40, true),
  ((select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), '1 taza', 1, 'taza', 80, false),
  ((select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), '1 cucharada', 1, 'cucharada', 5, false),
  ((select id from public.foods where name_normalized = 'avena cocida en agua' and created_by is null), '1 taza', 1, 'taza', 234, true),
  ((select id from public.foods where name_normalized = 'pan frances' and created_by is null), '1 unidad', 1, 'unidad', 30, true),
  ((select id from public.foods where name_normalized = 'pan de molde blanco' and created_by is null), '1 tajada', 1, 'tajada', 25, true),
  ((select id from public.foods where name_normalized = 'pan de molde integral' and created_by is null), '1 tajada', 1, 'tajada', 28, true),
  ((select id from public.foods where name_normalized = 'fideos cocidos' and created_by is null), '1 taza', 1, 'taza', 140, true),
  ((select id from public.foods where name_normalized = 'fideos cocidos' and created_by is null), '1 plato de fondo', 1, 'plato', 280, false),
  ((select id from public.foods where name_normalized = 'fideos secos' and created_by is null), '1 porción', 1, 'porción', 80, true),
  ((select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), '1 taza desgranado', 1, 'taza', 150, true),
  ((select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), '1 choclo mediano desgranado', 1, 'unidad', 200, false),
  ((select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), '1 rodaja', 1, 'rodaja', 60, false),
  ((select id from public.foods where name_normalized = 'cancha tostada' and created_by is null), '1 puñado', 1, 'puñado', 30, true),
  ((select id from public.foods where name_normalized = 'cancha tostada' and created_by is null), '1/2 taza', 0.5, 'taza', 50, false),
  ((select id from public.foods where name_normalized = 'harina de trigo' and created_by is null), '1 taza', 1, 'taza', 125, true),
  ((select id from public.foods where name_normalized = 'harina de trigo' and created_by is null), '1 cucharada', 1, 'cucharada', 8, false),
  ((select id from public.foods where name_normalized = 'harina de maiz amarillo' and created_by is null), '1 taza', 1, 'taza', 122, true),
  ((select id from public.foods where name_normalized = 'maicena (almidon de maiz)' and created_by is null), '1 cucharada', 1, 'cucharada', 8, true),
  ((select id from public.foods where name_normalized = 'galletas de soda' and created_by is null), '1 paquete individual (6 unidades)', 1, 'paquete', 36, true),
  ((select id from public.foods where name_normalized = 'galletas de soda' and created_by is null), '1 unidad', 1, 'unidad', 6, false);

-- Tubérculos y raíces
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), '1 unidad mediana', 1, 'unidad', 150, true),
  ((select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), '1 unidad pequeña', 1, 'unidad', 90, false),
  ((select id from public.foods where name_normalized = 'papa blanca sancochada' and created_by is null), '1 unidad mediana', 1, 'unidad', 150, true),
  ((select id from public.foods where name_normalized = 'papa blanca sancochada' and created_by is null), '1 unidad pequeña', 1, 'unidad', 90, false),
  ((select id from public.foods where name_normalized = 'papa blanca sancochada' and created_by is null), '1 taza en cubos', 1, 'taza', 156, false),
  ((select id from public.foods where name_normalized = 'papa amarilla sancochada' and created_by is null), '1 unidad mediana', 1, 'unidad', 120, true),
  ((select id from public.foods where name_normalized = 'papa amarilla sancochada' and created_by is null), '1 taza prensada', 1, 'taza', 200, false),
  ((select id from public.foods where name_normalized = 'papa huayro sancochada' and created_by is null), '1 unidad mediana', 1, 'unidad', 130, true),
  ((select id from public.foods where name_normalized = 'camote sancochado' and created_by is null), '1 trozo mediano', 1, 'trozo', 100, true),
  ((select id from public.foods where name_normalized = 'camote sancochado' and created_by is null), '1 rodaja gruesa', 1, 'rodaja', 60, false),
  ((select id from public.foods where name_normalized = 'camote sancochado' and created_by is null), '1 unidad mediana', 1, 'unidad', 200, false),
  ((select id from public.foods where name_normalized = 'yuca cruda' and created_by is null), '1 trozo mediano', 1, 'trozo', 100, true),
  ((select id from public.foods where name_normalized = 'yuca sancochada' and created_by is null), '1 trozo mediano', 1, 'trozo', 100, true),
  ((select id from public.foods where name_normalized = 'yuca sancochada' and created_by is null), '1 porción', 1, 'porción', 200, false),
  ((select id from public.foods where name_normalized = 'olluco' and created_by is null), '1 taza en tiras', 1, 'taza', 120, true),
  ((select id from public.foods where name_normalized = 'oca' and created_by is null), '1 unidad mediana', 1, 'unidad', 50, true),
  ((select id from public.foods where name_normalized = 'chuno seco' and created_by is null), '1 unidad mediana', 1, 'unidad', 15, true),
  ((select id from public.foods where name_normalized = 'chuno seco' and created_by is null), '1/4 taza', 0.25, 'taza', 35, false),
  ((select id from public.foods where name_normalized = 'papa seca' and created_by is null), '1/4 taza', 0.25, 'taza', 40, true),
  ((select id from public.foods where name_normalized = 'papa seca' and created_by is null), '1 taza', 1, 'taza', 160, false),
  ((select id from public.foods where name_normalized = 'papas fritas' and created_by is null), '1 porción mediana', 1, 'porción', 120, true),
  ((select id from public.foods where name_normalized = 'papas fritas' and created_by is null), '1 porción grande', 1, 'porción', 180, false);

-- Menestras
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'lentejas cocidas' and created_by is null), '1 taza', 1, 'taza', 198, true),
  ((select id from public.foods where name_normalized = 'lentejas cocidas' and created_by is null), '1/2 taza', 0.5, 'taza', 99, false),
  ((select id from public.foods where name_normalized = 'lentejas secas' and created_by is null), '1/2 taza', 0.5, 'taza', 96, true),
  ((select id from public.foods where name_normalized = 'lentejas secas' and created_by is null), '1 taza', 1, 'taza', 192, false),
  ((select id from public.foods where name_normalized = 'frejol canario cocido' and created_by is null), '1 taza', 1, 'taza', 177, true),
  ((select id from public.foods where name_normalized = 'frejol canario cocido' and created_by is null), '1/2 taza', 0.5, 'taza', 88, false),
  ((select id from public.foods where name_normalized = 'frejol canario seco' and created_by is null), '1/2 taza', 0.5, 'taza', 95, true),
  ((select id from public.foods where name_normalized = 'frejol canario seco' and created_by is null), '1 taza', 1, 'taza', 190, false),
  ((select id from public.foods where name_normalized = 'garbanzos cocidos' and created_by is null), '1 taza', 1, 'taza', 164, true),
  ((select id from public.foods where name_normalized = 'garbanzos cocidos' and created_by is null), '1/2 taza', 0.5, 'taza', 82, false),
  ((select id from public.foods where name_normalized = 'garbanzos secos' and created_by is null), '1/2 taza', 0.5, 'taza', 100, true),
  ((select id from public.foods where name_normalized = 'pallares cocidos' and created_by is null), '1 taza', 1, 'taza', 188, true),
  ((select id from public.foods where name_normalized = 'habas secas cocidas' and created_by is null), '1 taza', 1, 'taza', 170, true),
  ((select id from public.foods where name_normalized = 'habas verdes cocidas' and created_by is null), '1 taza', 1, 'taza', 170, true),
  ((select id from public.foods where name_normalized = 'habas verdes cocidas' and created_by is null), '1/2 taza', 0.5, 'taza', 85, false),
  ((select id from public.foods where name_normalized = 'arvejas verdes cocidas' and created_by is null), '1/2 taza', 0.5, 'taza', 80, true),
  ((select id from public.foods where name_normalized = 'arvejas verdes cocidas' and created_by is null), '1 taza', 1, 'taza', 160, false),
  ((select id from public.foods where name_normalized = 'arveja partida cocida' and created_by is null), '1 taza', 1, 'taza', 196, true),
  ((select id from public.foods where name_normalized = 'frejol negro cocido' and created_by is null), '1 taza', 1, 'taza', 172, true);

-- Carnes y aves
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), '1 filete mediano', 1, 'filete', 120, true),
  ((select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), '1/2 pechuga sin hueso', 0.5, 'pechuga', 200, false),
  ((select id from public.foods where name_normalized = 'pechuga de pollo sin piel, a la plancha' and created_by is null), '1 filete mediano', 1, 'filete', 100, true),
  ((select id from public.foods where name_normalized = 'pechuga de pollo sin piel, a la plancha' and created_by is null), '1 taza deshilachada', 1, 'taza', 140, false),
  ((select id from public.foods where name_normalized = 'pierna de pollo sin piel, cruda' and created_by is null), '1 pierna sin hueso', 1, 'presa', 150, true),
  ((select id from public.foods where name_normalized = 'pierna de pollo sin piel, cocida' and created_by is null), '1 pierna sin hueso', 1, 'presa', 120, true),
  ((select id from public.foods where name_normalized = 'pollo con piel, asado' and created_by is null), '1 presa mediana sin hueso', 1, 'presa', 120, true),
  ((select id from public.foods where name_normalized = 'pollo con piel, asado' and created_by is null), '1/4 de pollo sin hueso', 0.25, 'pollo', 200, false),
  ((select id from public.foods where name_normalized = 'carne de res magra, cruda' and created_by is null), '1 bistec mediano', 1, 'bistec', 120, true),
  ((select id from public.foods where name_normalized = 'carne de res magra, a la plancha' and created_by is null), '1 bistec mediano', 1, 'bistec', 90, true),
  ((select id from public.foods where name_normalized = 'lomo fino de res, crudo' and created_by is null), '1 porción', 1, 'porción', 150, true),
  ((select id from public.foods where name_normalized = 'carne molida de res 90 % magra, cruda' and created_by is null), '1 porción', 1, 'porción', 120, true),
  ((select id from public.foods where name_normalized = 'carne molida de res 80 % magra, cruda' and created_by is null), '1 porción', 1, 'porción', 120, true),
  ((select id from public.foods where name_normalized = 'lomo de cerdo, crudo' and created_by is null), '1 filete mediano', 1, 'filete', 120, true),
  ((select id from public.foods where name_normalized = 'pierna de cerdo, cruda' and created_by is null), '1 porción', 1, 'porción', 120, true),
  ((select id from public.foods where name_normalized = 'higado de res, crudo' and created_by is null), '1 bistec', 1, 'bistec', 100, true),
  ((select id from public.foods where name_normalized = 'pechuga de pavo, cruda' and created_by is null), '1 filete mediano', 1, 'filete', 120, true),
  ((select id from public.foods where name_normalized = 'corazon de res, crudo' and created_by is null), '1 porción', 1, 'porción', 120, true),
  ((select id from public.foods where name_normalized = 'salchicha de hot dog' and created_by is null), '1 unidad', 1, 'unidad', 40, true);

-- Pescados y mariscos
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'bonito, crudo' and created_by is null), '1 filete mediano', 1, 'filete', 150, true),
  ((select id from public.foods where name_normalized = 'jurel, crudo' and created_by is null), '1 trozo mediano', 1, 'trozo', 150, true),
  ((select id from public.foods where name_normalized = 'caballa, cruda' and created_by is null), '1 trozo mediano', 1, 'trozo', 150, true),
  ((select id from public.foods where name_normalized = 'perico (dorado), crudo' and created_by is null), '1 filete mediano', 1, 'filete', 150, true),
  ((select id from public.foods where name_normalized = 'tilapia, cruda' and created_by is null), '1 filete mediano', 1, 'filete', 120, true),
  ((select id from public.foods where name_normalized = 'trucha, cruda' and created_by is null), '1 filete mediano', 1, 'filete', 150, true),
  ((select id from public.foods where name_normalized = 'merluza, cruda' and created_by is null), '1 filete mediano', 1, 'filete', 150, true),
  ((select id from public.foods where name_normalized = 'atun en agua, escurrido' and created_by is null), '1 lata escurrida', 1, 'lata', 120, true),
  ((select id from public.foods where name_normalized = 'atun en agua, escurrido' and created_by is null), '1/2 taza', 0.5, 'taza', 80, false),
  ((select id from public.foods where name_normalized = 'atun en aceite, escurrido' and created_by is null), '1 lata escurrida', 1, 'lata', 120, true),
  ((select id from public.foods where name_normalized = 'sardinas en aceite, escurridas' and created_by is null), '1 lata escurrida', 1, 'lata', 90, true),
  ((select id from public.foods where name_normalized = 'pota, cruda' and created_by is null), '1 porción', 1, 'porción', 150, true),
  ((select id from public.foods where name_normalized = 'langostinos, crudos' and created_by is null), '1 porción', 1, 'porción', 100, true),
  ((select id from public.foods where name_normalized = 'langostinos, crudos' and created_by is null), '1 unidad mediana', 1, 'unidad', 15, false),
  ((select id from public.foods where name_normalized = 'conchas negras, crudas' and created_by is null), '1 unidad', 1, 'unidad', 12, true),
  ((select id from public.foods where name_normalized = 'conchas de abanico, crudas' and created_by is null), '1 unidad', 1, 'unidad', 12, true),
  ((select id from public.foods where name_normalized = 'choros (mejillones), crudos' and created_by is null), '1 unidad', 1, 'unidad', 10, true);

-- Huevos
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), '1 unidad mediana', 1, 'unidad', 50, true),
  ((select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), '1 unidad grande', 1, 'unidad', 60, false),
  ((select id from public.foods where name_normalized = 'huevo sancochado' and created_by is null), '1 unidad', 1, 'unidad', 50, true),
  ((select id from public.foods where name_normalized = 'huevo frito' and created_by is null), '1 unidad', 1, 'unidad', 46, true),
  ((select id from public.foods where name_normalized = 'clara de huevo' and created_by is null), '1 clara', 1, 'clara', 33, true),
  ((select id from public.foods where name_normalized = 'huevo de codorniz' and created_by is null), '1 unidad', 1, 'unidad', 9, true);

-- Lácteos y alternativas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'leche entera' and created_by is null), '1 taza', 1, 'taza', 245, true),
  ((select id from public.foods where name_normalized = 'leche entera' and created_by is null), '1 vaso (200 ml)', 1, 'vaso', 206, false),
  ((select id from public.foods where name_normalized = 'leche descremada' and created_by is null), '1 taza', 1, 'taza', 245, true),
  ((select id from public.foods where name_normalized = 'leche descremada' and created_by is null), '1 vaso (200 ml)', 1, 'vaso', 207, false),
  ((select id from public.foods where name_normalized = 'leche evaporada entera' and created_by is null), '1 cucharada', 1, 'cucharada', 16, true),
  ((select id from public.foods where name_normalized = 'leche evaporada entera' and created_by is null), '1/2 taza', 0.5, 'taza', 126, false),
  ((select id from public.foods where name_normalized = 'leche evaporada entera' and created_by is null), '1 lata', 1, 'lata', 400, false),
  ((select id from public.foods where name_normalized = 'leche evaporada descremada' and created_by is null), '1 cucharada', 1, 'cucharada', 16, true),
  ((select id from public.foods where name_normalized = 'leche evaporada descremada' and created_by is null), '1/2 taza', 0.5, 'taza', 128, false),
  ((select id from public.foods where name_normalized = 'leche evaporada descremada' and created_by is null), '1 lata', 1, 'lata', 400, false),
  ((select id from public.foods where name_normalized = 'yogurt natural sin azucar' and created_by is null), '1 taza', 1, 'taza', 245, true),
  ((select id from public.foods where name_normalized = 'yogurt natural sin azucar' and created_by is null), '1 vaso (200 ml)', 1, 'vaso', 208, false),
  ((select id from public.foods where name_normalized = 'yogurt griego natural sin grasa' and created_by is null), '1 envase individual', 1, 'envase', 170, true),
  ((select id from public.foods where name_normalized = 'yogurt griego natural sin grasa' and created_by is null), '1 cucharada', 1, 'cucharada', 20, false),
  ((select id from public.foods where name_normalized = 'queso fresco' and created_by is null), '1 tajada', 1, 'tajada', 30, true),
  ((select id from public.foods where name_normalized = 'queso andino' and created_by is null), '1 tajada', 1, 'tajada', 25, true),
  ((select id from public.foods where name_normalized = 'leche condensada' and created_by is null), '1 cucharada', 1, 'cucharada', 20, true),
  ((select id from public.foods where name_normalized = 'manjar blanco' and created_by is null), '1 cucharada', 1, 'cucharada', 20, true),
  ((select id from public.foods where name_normalized = 'mantequilla con sal' and created_by is null), '1 cucharadita', 1, 'cucharadita', 5, true),
  ((select id from public.foods where name_normalized = 'mantequilla con sal' and created_by is null), '1 cucharada', 1, 'cucharada', 14, false),
  ((select id from public.foods where name_normalized = 'tofu' and created_by is null), '1 porción', 1, 'porción', 100, true);

-- Frutas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'platano de seda' and created_by is null), '1 unidad mediana (pulpa)', 1, 'unidad', 110, true),
  ((select id from public.foods where name_normalized = 'platano de isla' and created_by is null), '1 unidad (pulpa)', 1, 'unidad', 60, true),
  ((select id from public.foods where name_normalized = 'manzana' and created_by is null), '1 unidad mediana', 1, 'unidad', 180, true),
  ((select id from public.foods where name_normalized = 'papaya' and created_by is null), '1 taza en cubos', 1, 'taza', 145, true),
  ((select id from public.foods where name_normalized = 'mango' and created_by is null), '1 taza en cubos', 1, 'taza', 165, true),
  ((select id from public.foods where name_normalized = 'mango' and created_by is null), '1 unidad mediana (pulpa)', 1, 'unidad', 300, false),
  ((select id from public.foods where name_normalized = 'pina' and created_by is null), '1 taza en cubos', 1, 'taza', 165, true),
  ((select id from public.foods where name_normalized = 'pina' and created_by is null), '1 tajada', 1, 'tajada', 85, false),
  ((select id from public.foods where name_normalized = 'naranja' and created_by is null), '1 unidad mediana (pulpa)', 1, 'unidad', 130, true),
  ((select id from public.foods where name_normalized = 'mandarina' and created_by is null), '1 unidad mediana (pulpa)', 1, 'unidad', 85, true),
  ((select id from public.foods where name_normalized = 'lucuma' and created_by is null), '1 unidad mediana (pulpa)', 1, 'unidad', 150, true),
  ((select id from public.foods where name_normalized = 'chirimoya' and created_by is null), '1 taza', 1, 'taza', 160, true),
  ((select id from public.foods where name_normalized = 'aguaymanto' and created_by is null), '1 taza', 1, 'taza', 140, true),
  ((select id from public.foods where name_normalized = 'aguaymanto' and created_by is null), '10 unidades', 10, 'unidad', 45, false),
  ((select id from public.foods where name_normalized = 'granadilla' and created_by is null), '1 unidad (pulpa)', 1, 'unidad', 50, true),
  ((select id from public.foods where name_normalized = 'maracuya, pulpa colada' and created_by is null), '1/4 taza', 0.25, 'taza', 62, true),
  ((select id from public.foods where name_normalized = 'camu camu, pulpa' and created_by is null), '1/4 taza', 0.25, 'taza', 60, true),
  ((select id from public.foods where name_normalized = 'palta' and created_by is null), '1/4 de palta mediana', 0.25, 'unidad', 50, true),
  ((select id from public.foods where name_normalized = 'palta' and created_by is null), '1 cucharada', 1, 'cucharada', 15, false),
  ((select id from public.foods where name_normalized = 'fresa' and created_by is null), '1 taza', 1, 'taza', 150, true),
  ((select id from public.foods where name_normalized = 'fresa' and created_by is null), '1 unidad mediana', 1, 'unidad', 12, false),
  ((select id from public.foods where name_normalized = 'uva' and created_by is null), '1 taza', 1, 'taza', 150, true),
  ((select id from public.foods where name_normalized = 'uva' and created_by is null), '10 unidades', 10, 'unidad', 50, false),
  ((select id from public.foods where name_normalized = 'sandia' and created_by is null), '1 taza en cubos', 1, 'taza', 150, true),
  ((select id from public.foods where name_normalized = 'sandia' and created_by is null), '1 tajada', 1, 'tajada', 280, false),
  ((select id from public.foods where name_normalized = 'melon' and created_by is null), '1 taza en cubos', 1, 'taza', 160, true),
  ((select id from public.foods where name_normalized = 'tuna (fruta)' and created_by is null), '1 unidad (pulpa)', 1, 'unidad', 100, true),
  ((select id from public.foods where name_normalized = 'pasas' and created_by is null), '1 cucharada', 1, 'cucharada', 10, true),
  ((select id from public.foods where name_normalized = 'pasas' and created_by is null), '1 puñado', 1, 'puñado', 30, false),
  ((select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), '1 cucharada', 1, 'cucharada', 15, true),
  ((select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 'Jugo de 1 limón', 1, 'limón', 12, false),
  ((select id from public.foods where name_normalized = 'aceituna de botija' and created_by is null), '1 unidad', 1, 'unidad', 6, true);

-- Verduras y hortalizas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'lechuga' and created_by is null), '1 taza picada', 1, 'taza', 40, true),
  ((select id from public.foods where name_normalized = 'lechuga' and created_by is null), '1 hoja grande', 1, 'hoja', 15, false),
  ((select id from public.foods where name_normalized = 'tomate' and created_by is null), '1 unidad mediana', 1, 'unidad', 120, true),
  ((select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), '1 unidad mediana', 1, 'unidad', 150, true),
  ((select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), '1/2 taza picada', 0.5, 'taza', 80, false),
  ((select id from public.foods where name_normalized = 'cebolla china' and created_by is null), '1 tallo', 1, 'tallo', 15, true),
  ((select id from public.foods where name_normalized = 'ajo' and created_by is null), '1 diente', 1, 'diente', 4, true),
  ((select id from public.foods where name_normalized = 'ajo' and created_by is null), '1 cucharada molido', 1, 'cucharada', 9, false),
  ((select id from public.foods where name_normalized = 'zanahoria' and created_by is null), '1 unidad mediana', 1, 'unidad', 75, true),
  ((select id from public.foods where name_normalized = 'zanahoria' and created_by is null), '1 taza rallada', 1, 'taza', 110, false),
  ((select id from public.foods where name_normalized = 'brocoli' and created_by is null), '1 taza en floretes', 1, 'taza', 90, true),
  ((select id from public.foods where name_normalized = 'espinaca' and created_by is null), '1 taza', 1, 'taza', 30, true),
  ((select id from public.foods where name_normalized = 'zapallo macre' and created_by is null), '1 taza en cubos', 1, 'taza', 115, true),
  ((select id from public.foods where name_normalized = 'zapallo macre' and created_by is null), '1 trozo', 1, 'trozo', 150, false),
  ((select id from public.foods where name_normalized = 'zapallito italiano' and created_by is null), '1 unidad mediana', 1, 'unidad', 200, true),
  ((select id from public.foods where name_normalized = 'vainita' and created_by is null), '1 taza', 1, 'taza', 100, true),
  ((select id from public.foods where name_normalized = 'pepino' and created_by is null), '1 unidad mediana', 1, 'unidad', 200, true),
  ((select id from public.foods where name_normalized = 'pepino' and created_by is null), '1/2 taza en rodajas', 0.5, 'taza', 52, false),
  ((select id from public.foods where name_normalized = 'beterraga sancochada' and created_by is null), '1 unidad mediana', 1, 'unidad', 100, true),
  ((select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), '1 unidad', 1, 'unidad', 40, true),
  ((select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), '1 cucharada licuado', 1, 'cucharada', 15, false),
  ((select id from public.foods where name_normalized = 'rocoto' and created_by is null), '1 unidad mediana', 1, 'unidad', 100, true),
  ((select id from public.foods where name_normalized = 'rocoto' and created_by is null), '1 cucharada picado', 1, 'cucharada', 10, false),
  ((select id from public.foods where name_normalized = 'aji panca seco' and created_by is null), '1 unidad', 1, 'unidad', 8, true),
  ((select id from public.foods where name_normalized = 'pimiento rojo' and created_by is null), '1 unidad mediana', 1, 'unidad', 130, true),
  ((select id from public.foods where name_normalized = 'coliflor' and created_by is null), '1 taza', 1, 'taza', 100, true),
  ((select id from public.foods where name_normalized = 'repollo' and created_by is null), '1 taza picado', 1, 'taza', 90, true),
  ((select id from public.foods where name_normalized = 'apio' and created_by is null), '1 tallo', 1, 'tallo', 40, true),
  ((select id from public.foods where name_normalized = 'culantro' and created_by is null), '1/4 taza picado', 0.25, 'taza', 4, true),
  ((select id from public.foods where name_normalized = 'culantro' and created_by is null), '1 atado', 1, 'atado', 100, false),
  ((select id from public.foods where name_normalized = 'albahaca' and created_by is null), '1 taza de hojas', 1, 'taza', 24, true),
  ((select id from public.foods where name_normalized = 'champinones' and created_by is null), '1 taza en láminas', 1, 'taza', 70, true),
  ((select id from public.foods where name_normalized = 'kion (jengibre)' and created_by is null), '1 cucharadita rallado', 1, 'cucharadita', 2, true),
  ((select id from public.foods where name_normalized = 'kion (jengibre)' and created_by is null), '1 trozo de 2 cm', 1, 'trozo', 10, false);

-- Grasas, frutos secos y semillas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), '1 cucharada', 1, 'cucharada', 14, true),
  ((select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), '1 cucharadita', 1, 'cucharadita', 5, false),
  ((select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), '1 cucharada', 1, 'cucharada', 14, true),
  ((select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), '1 cucharadita', 1, 'cucharadita', 5, false),
  ((select id from public.foods where name_normalized = 'mayonesa' and created_by is null), '1 cucharada', 1, 'cucharada', 14, true),
  ((select id from public.foods where name_normalized = 'mani tostado sin sal' and created_by is null), '1 puñado', 1, 'puñado', 30, true),
  ((select id from public.foods where name_normalized = 'mani tostado sin sal' and created_by is null), '1 cucharada', 1, 'cucharada', 9, false),
  ((select id from public.foods where name_normalized = 'mantequilla de mani' and created_by is null), '1 cucharada', 1, 'cucharada', 16, true),
  ((select id from public.foods where name_normalized = 'sacha inchi tostado' and created_by is null), '1 puñado', 1, 'puñado', 30, true),
  ((select id from public.foods where name_normalized = 'almendras' and created_by is null), '1 puñado', 1, 'puñado', 28, true),
  ((select id from public.foods where name_normalized = 'nueces' and created_by is null), '1 puñado', 1, 'puñado', 28, true),
  ((select id from public.foods where name_normalized = 'chia' and created_by is null), '1 cucharada', 1, 'cucharada', 12, true),
  ((select id from public.foods where name_normalized = 'linaza' and created_by is null), '1 cucharada', 1, 'cucharada', 10, true);

-- Azúcares, condimentos y otros
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'azucar blanca' and created_by is null), '1 cucharadita', 1, 'cucharadita', 4, true),
  ((select id from public.foods where name_normalized = 'azucar blanca' and created_by is null), '1 cucharada', 1, 'cucharada', 12, false),
  ((select id from public.foods where name_normalized = 'azucar rubia' and created_by is null), '1 cucharadita', 1, 'cucharadita', 4, true),
  ((select id from public.foods where name_normalized = 'azucar rubia' and created_by is null), '1 cucharada', 1, 'cucharada', 12, false),
  ((select id from public.foods where name_normalized = 'miel de abeja' and created_by is null), '1 cucharadita', 1, 'cucharadita', 7, true),
  ((select id from public.foods where name_normalized = 'miel de abeja' and created_by is null), '1 cucharada', 1, 'cucharada', 21, false),
  ((select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), '1 cucharadita', 1, 'cucharadita', 6, true),
  ((select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), '1 pizca', 1, 'pizca', 0.5, false),
  ((select id from public.foods where name_normalized = 'sillao (salsa de soya)' and created_by is null), '1 cucharada', 1, 'cucharada', 16, true),
  ((select id from public.foods where name_normalized = 'vinagre' and created_by is null), '1 cucharada', 1, 'cucharada', 15, true),
  ((select id from public.foods where name_normalized = 'cafe pasado' and created_by is null), '1 taza', 1, 'taza', 240, true);

-- Bebidas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'gaseosa regular' and created_by is null), '1 vaso (250 ml)', 1, 'vaso', 260, true),
  ((select id from public.foods where name_normalized = 'gaseosa regular' and created_by is null), '1 botella personal (500 ml)', 1, 'botella', 520, false),
  ((select id from public.foods where name_normalized = 'cerveza' and created_by is null), '1 vaso (250 ml)', 1, 'vaso', 252, true),
  ((select id from public.foods where name_normalized = 'cerveza' and created_by is null), '1 botella (620 ml)', 1, 'botella', 626, false),
  ((select id from public.foods where name_normalized = 'jugo de naranja natural' and created_by is null), '1 vaso (250 ml)', 1, 'vaso', 260, true);

-- Platos y preparaciones peruanas
insert into public.food_portions (food_id, label, quantity, unit, gram_weight, is_default)
values
  ((select id from public.foods where name_normalized = 'arroz blanco graneado' and created_by is null), '1 taza', 1, 'taza', 160, true),
  ((select id from public.foods where name_normalized = 'arroz blanco graneado' and created_by is null), '1 porción de menú', 1, 'porción', 200, false),
  ((select id from public.foods where name_normalized = 'ceviche de pescado' and created_by is null), '1 plato (solo ceviche)', 1, 'plato', 250, true),
  ((select id from public.foods where name_normalized = 'lomo saltado' and created_by is null), '1 porción sin arroz', 1, 'porción', 300, true),
  ((select id from public.foods where name_normalized = 'pollo a la brasa con piel' and created_by is null), '1/4 de pollo, parte comestible', 0.25, 'pollo', 200, true),
  ((select id from public.foods where name_normalized = 'pollo a la brasa con piel' and created_by is null), '1/8 de pollo, parte comestible', 0.125, 'pollo', 100, false),
  ((select id from public.foods where name_normalized = 'aji de gallina' and created_by is null), '1 porción sin arroz', 1, 'porción', 200, true),
  ((select id from public.foods where name_normalized = 'causa limena de pollo' and created_by is null), '1 porción', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'arroz con pollo' and created_by is null), '1 plato', 1, 'plato', 450, true),
  ((select id from public.foods where name_normalized = 'seco de res' and created_by is null), '1 porción sin arroz', 1, 'porción', 300, true),
  ((select id from public.foods where name_normalized = 'tacu tacu' and created_by is null), '1 porción', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'anticuchos de corazon' and created_by is null), '1 palito', 1, 'palito', 80, true),
  ((select id from public.foods where name_normalized = 'anticuchos de corazon' and created_by is null), '1 porción (2 palitos)', 2, 'palito', 160, false),
  ((select id from public.foods where name_normalized = 'papa a la huancaina' and created_by is null), '1 porción', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'rocoto relleno' and created_by is null), '1 unidad', 1, 'unidad', 230, true),
  ((select id from public.foods where name_normalized = 'carapulcra' and created_by is null), '1 porción', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'juane de gallina' and created_by is null), '1 juane', 1, 'unidad', 350, true),
  ((select id from public.foods where name_normalized = 'tamal criollo' and created_by is null), '1 tamal', 1, 'unidad', 180, true),
  ((select id from public.foods where name_normalized = 'humita dulce' and created_by is null), '1 humita', 1, 'unidad', 150, true),
  ((select id from public.foods where name_normalized = 'arroz chaufa de pollo' and created_by is null), '1 plato', 1, 'plato', 400, true),
  ((select id from public.foods where name_normalized = 'tallarines verdes' and created_by is null), '1 plato', 1, 'plato', 350, true),
  ((select id from public.foods where name_normalized = 'sudado de pescado' and created_by is null), '1 porción con su jugo', 1, 'porción', 350, true),
  ((select id from public.foods where name_normalized = 'chupe de camarones' and created_by is null), '1 plato', 1, 'plato', 450, true),
  ((select id from public.foods where name_normalized = 'parihuela' and created_by is null), '1 plato', 1, 'plato', 450, true),
  ((select id from public.foods where name_normalized = 'caldo de gallina' and created_by is null), '1 plato', 1, 'plato', 500, true),
  ((select id from public.foods where name_normalized = 'menestron' and created_by is null), '1 plato', 1, 'plato', 500, true),
  ((select id from public.foods where name_normalized = 'adobo de cerdo' and created_by is null), '1 porción', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'olluquito con carne' and created_by is null), '1 porción sin arroz', 1, 'porción', 250, true),
  ((select id from public.foods where name_normalized = 'estofado de pollo' and created_by is null), '1 porción sin arroz', 1, 'porción', 300, true),
  ((select id from public.foods where name_normalized = 'salchipapa' and created_by is null), '1 porción mediana', 1, 'porción', 350, true),
  ((select id from public.foods where name_normalized = 'pan con chicharron' and created_by is null), '1 sánguche', 1, 'unidad', 250, true),
  ((select id from public.foods where name_normalized = 'butifarra' and created_by is null), '1 sánguche', 1, 'unidad', 190, true),
  ((select id from public.foods where name_normalized = 'picarones con miel' and created_by is null), '1 porción (4 unidades con miel)', 1, 'porción', 200, true),
  ((select id from public.foods where name_normalized = 'suspiro limeno' and created_by is null), '1 copa', 1, 'copa', 120, true),
  ((select id from public.foods where name_normalized = 'mazamorra morada' and created_by is null), '1 taza', 1, 'taza', 250, true),
  ((select id from public.foods where name_normalized = 'arroz con leche' and created_by is null), '1 taza', 1, 'taza', 250, true),
  ((select id from public.foods where name_normalized = 'alfajor de manjar blanco' and created_by is null), '1 unidad', 1, 'unidad', 40, true),
  ((select id from public.foods where name_normalized = 'leche de tigre' and created_by is null), '1 vaso', 1, 'vaso', 250, true),
  ((select id from public.foods where name_normalized = 'chicha morada' and created_by is null), '1 vaso (250 ml)', 1, 'vaso', 260, true),
  ((select id from public.foods where name_normalized = 'emoliente' and created_by is null), '1 vaso (250 ml)', 1, 'vaso', 255, true);

commit;
