-- ORANGE FIT · seed pendiente 20 · Recetas oficiales (Perú).
--
-- Requiere 10_foods.sql cargado. Recetas oficiales: owner_id null, status 'published', is_public true,
-- image_path null (las imágenes se suben después; ver docs/IMAGE_PROMPTS.md).
-- La nutrición NO se guarda aquí: la calcula la vista public.recipe_nutrition desde los ingredientes.
-- diet_tags y allergens se calcularon desde los ingredientes con las reglas de docs/DATA_SOURCES.md.
-- estimated_cost = costo TOTAL de la receta (todas las porciones) en PEN, calculado con los precios
-- referenciales de 30_reference_prices.sql (sin fuente verificada). Es solo una referencia.
-- reviewed_by/reviewed_at quedan en null: falta la revisión de un profesional (ver DATA_SOURCES.md).
-- No es idempotente: si ya se cargó, el bloque de guarda aborta sin escribir nada.
-- Generado por un script; 36 recetas.

begin;

do $$
begin
  if exists (select 1 from public.recipes where slug = 'avena-con-platano-y-chia') then
    raise exception 'supabase/seed/20_recipes.sql ya fue cargado (existe la receta "avena-con-platano-y-chia"). No se escribió nada.';
  end if;
end;
$$;

insert into public.recipes (owner_id, title, slug, description, servings, prep_minutes, cook_minutes, difficulty, steps, image_path, tags, diet_tags, allergens, meal_types, country_code, estimated_cost, cost_currency, status, is_public)
values
  (null, 'Avena con plátano y chía', 'avena-con-platano-y-chia', 'Avena cocida con leche descremada, plátano en rodajas y chía. Llena bastante y se prepara en minutos.', 1, 5, 10, 'easy',
   '["Calienta la leche con media taza de agua en una olla pequeña a fuego medio.","Agrega la avena y cocina de 5 a 7 minutos, moviendo para que no se pegue, hasta que espese.","Apaga el fuego, añade la chía y deja reposar 2 minutos para que se hidrate.","Sirve con el plátano en rodajas encima. Si quieres, espolvorea canela; no hace falta azúcar."]',
   null, '{desayuno,casero,"sin horno"}', '{vegetarian,budget,quick}', '{gluten,lactosa}', '{breakfast}', 'PE', 2.50, 'PEN', 'published', true),
  (null, 'Pan integral con palta y huevo', 'pan-integral-con-palta-y-huevo', 'Tostadas de pan integral con palta machacada, huevo sancochado y tomate.', 1, 5, 10, 'easy',
   '["Pon los huevos en agua fría, lleva a hervor y cocina 9 minutos. Pásalos a agua fría y pélalos.","Tuesta el pan en una sartén o tostadora.","Machaca la palta con un tenedor y una pizca de sal.","Unta la palta sobre el pan, coloca el tomate en rodajas y el huevo en tajadas."]',
   null, '{desayuno,casero}', '{vegetarian,budget,quick}', '{gluten,huevo}', '{breakfast}', 'PE', 2.60, 'PEN', 'published', true),
  (null, 'Revuelto de huevos con espinaca', 'revuelto-de-huevos-con-espinaca', 'Huevos y claras revueltos con espinaca, tomate y cebolla. Alto en proteína y bajo en carbohidratos.', 1, 5, 5, 'easy',
   '["Calienta el aceite en una sartén antiadherente y sofríe la cebolla 1 minuto.","Agrega el tomate y la espinaca; cocina hasta que la espinaca se reduzca.","Bate los huevos con las claras y la sal, viértelos en la sartén y mueve con suavidad.","Retira cuando estén cuajados pero jugosos y sirve de inmediato."]',
   null, '{desayuno,"cena ligera","rápida"}', '{vegetarian,high_protein,low_carb,budget,quick}', '{huevo}', '{breakfast,dinner}', 'PE', 2.60, 'PEN', 'published', true),
  (null, 'Quinua con manzana', 'quinua-con-manzana', 'La clásica bebida de desayuno con quinua, manzana y canela, con menos azúcar de lo habitual.', 4, 10, 30, 'easy',
   '["Lava la quinua frotándola con las manos en varias aguas hasta que deje de hacer espuma.","Hierve litro y medio de agua con una rama de canela y dos clavos de olor.","Agrega la quinua y la manzana picada; cocina a fuego bajo 25 minutos, hasta que la quinua esté reventada.","Licúa la mitad si la quieres más espesa, endulza con el azúcar rubia y sirve caliente o tibia."]',
   null, '{desayuno,tradicional,"bebida caliente"}', '{vegetarian,vegan,budget}', '{}', '{breakfast,snack}', 'PE', 2.70, 'PEN', 'published', true),
  (null, 'Yogurt griego con fresas y chía', 'yogurt-griego-con-fresas-y-chia', 'Yogurt griego natural con fresas, chía y un toque de miel. Listo en cinco minutos.', 1, 5, 0, 'easy',
   '["Lava las fresas, quítales el tallo y córtalas en cuartos.","Sirve el yogurt en un bowl y coloca las fresas encima.","Espolvorea la chía y termina con la miel."]',
   null, '{desayuno,"sin cocción","rápida"}', '{vegetarian,quick}', '{lactosa}', '{breakfast,snack}', 'PE', 5.40, 'PEN', 'published', true),
  (null, 'Panqueques de avena y plátano', 'panqueques-de-avena-y-platano', 'Panqueques sin harina ni azúcar añadida: solo avena, plátano maduro, huevo y leche.', 2, 10, 15, 'easy',
   '["Licúa la avena, los plátanos, los huevos y la leche hasta obtener una mezcla espesa. Añade canela si te gusta.","Calienta una sartén antiadherente a fuego medio y engrásala con unas gotas de aceite.","Vierte un cucharón de mezcla por panqueque y cocina 2 minutos por lado, hasta que dore.","Repite con el resto de la mezcla; salen unos 6 panqueques."]',
   null, '{desayuno,casero,"sin azúcar añadida"}', '{vegetarian,budget}', '{gluten,lactosa,huevo}', '{breakfast}', 'PE', 3.10, 'PEN', 'published', true),
  (null, 'Sánguche de pollo y palta', 'sanguche-de-pollo-y-palta', 'Pan integral con pollo deshilachado, palta, lechuga y tomate. Ideal para usar pollo ya cocido.', 1, 10, 0, 'easy',
   '["Mezcla el pollo deshilachado con el jugo de limón y la sal.","Machaca la palta y úntala sobre una tajada de pan.","Coloca la lechuga, el tomate y el pollo; cierra con la otra tajada."]',
   null, '{"para llevar","rápida","aprovecha sobras"}', '{high_protein,budget,quick}', '{gluten}', '{breakfast,snack}', 'PE', 3.60, 'PEN', 'published', true),
  (null, 'Saltado de pollo con arroz integral', 'saltado-de-pollo-con-arroz-integral', 'Todo el sabor del saltado con pechuga de pollo, papa sancochada en vez de frita y arroz integral.', 2, 15, 35, 'medium',
   '["Cocina el arroz integral con el doble de agua y una pizca de sal, tapado y a fuego bajo, unos 35 minutos.","Sancocha las papas, déjalas enfriar y córtalas en bastones gruesos.","Calienta una sartén grande o wok con el aceite a fuego alto y dora el pollo con el ajo, por tandas para que no hierva.","Agrega la cebolla y el ají; saltea 1 minuto. Añade el tomate, el sillao y el vinagre por los bordes.","Incorpora las papas, mezcla con cuidado y termina con culantro. Sirve con el arroz."]',
   null, '{"clásico peruano","versión ligera"}', '{high_protein,budget}', '{gluten,soya}', '{lunch,dinner}', 'PE', 8.70, 'PEN', 'published', true),
  (null, 'Ceviche de pescado con camote y choclo', 'ceviche-de-pescado-con-camote-y-choclo', 'Ceviche de perico con limón, cebolla y rocoto, acompañado de camote y choclo sancochados.', 2, 20, 25, 'medium',
   '["Sancocha el camote y el choclo por separado; deja que enfríen.","Lava la cebolla en pluma con agua fría y escúrrela bien.","Sazona el pescado con la sal, agrega el rocoto y exprime encima el limón, sin apretar demasiado para que no amargue.","Mezcla, deja reposar 2 o 3 minutos y añade la cebolla y el culantro.","Sirve de inmediato sobre hojas de lechuga, con el camote y el choclo al lado."]',
   null, '{"clásico peruano",marino,fresco}', '{high_protein}', '{pescado}', '{lunch}', 'PE', 12.90, 'PEN', 'published', true),
  (null, 'Arroz con pollo ligero', 'arroz-con-pollo-ligero', 'Arroz verde con culantro y espinaca, pierna de pollo sin piel y muchas verduras.', 4, 20, 40, 'medium',
   '["Licúa el culantro y la espinaca con media taza de agua.","Dora las presas de pollo en una olla con el aceite y retíralas.","En la misma olla prepara un aderezo con la cebolla, el ajo y el ají amarillo; agrega el licuado verde y cocina 3 minutos.","Regresa el pollo, añade 3 tazas de agua y la sal; cocina 15 minutos.","Agrega el arroz, la zanahoria, las arvejas, el choclo y el pimiento. Tapa y cocina a fuego bajo 20 minutos, hasta que el arroz esté graneado."]',
   null, '{"clásico peruano","una olla","para la familia"}', '{high_protein,budget}', '{}', '{lunch}', 'PE', 16.10, 'PEN', 'published', true),
  (null, 'Seco de res con frejol canario', 'seco-de-res-con-frejol-canario', 'Guiso de res magra en salsa de culantro con frejol canario. Rinde para varios días.', 4, 20, 90, 'medium',
   '["Cocina el frejol remojado en agua sin sal hasta que esté suave (40 a 60 minutos) y sazónalo al final.","Licúa el culantro con media taza de agua.","Dora la carne en una olla con el aceite. Agrega la cebolla, el ajo y el ají y cocina hasta que la cebolla esté transparente.","Añade el licuado de culantro, la sal y agua hasta cubrir. Cocina tapado a fuego bajo 60 minutos o hasta que la carne esté suave.","Agrega la zanahoria y las arvejas los últimos 15 minutos. Sirve con el frejol."]',
   null, '{"clásico peruano",guiso,"meal prep"}', '{high_protein}', '{}', '{lunch}', 'PE', 20.80, 'PEN', 'published', true),
  (null, 'Lentejas con arroz y huevo', 'lentejas-con-arroz-y-huevo', 'Lentejas guisadas con aderezo de ají panca, arroz blanco y huevo. Económico y rendidor.', 4, 15, 45, 'easy',
   '["Lava las lentejas y cocínalas en agua sin sal unos 25 minutos, hasta que estén suaves.","Prepara el aderezo con el aceite, la cebolla, el ajo y el ají panca; agrega el tomate y la zanahoria y cocina 5 minutos.","Junta el aderezo con las lentejas, sazona con la sal y cocina 10 minutos más, moviendo de vez en cuando.","Cocina el arroz aparte con el doble de agua.","Sancocha o fríe los huevos con muy poco aceite. Sirve las lentejas con arroz, huevo y culantro."]',
   null, '{"menú casero","económica","meal prep"}', '{vegetarian,budget}', '{huevo}', '{lunch}', 'PE', 6.10, 'PEN', 'published', true),
  (null, 'Tacu tacu con huevo y ensalada', 'tacu-tacu-con-huevo-y-ensalada', 'Arroz y frejol del día anterior dorados en sartén, con huevo y ensalada fresca.', 2, 15, 20, 'medium',
   '["Sofríe la cebolla, el ajo y el ají con la mitad del aceite.","Agrega el frejol, aplástalo un poco y luego el arroz; mezcla hasta formar una masa.","Con el resto del aceite, dora la masa en una sartén antiadherente dándole forma de tortilla, 4 minutos por lado.","Fríe o sancocha los huevos y prepara la ensalada de lechuga y tomate con limón y sal.","Sirve el tacu tacu con el huevo encima y la ensalada al lado."]',
   null, '{"clásico peruano","aprovecha sobras"}', '{vegetarian,budget}', '{huevo}', '{lunch}', 'PE', 4.00, 'PEN', 'published', true),
  (null, 'Sudado de jurel con yuca', 'sudado-de-jurel-con-yuca', 'Jurel cocido en su jugo con tomate, cebolla y ají, servido con yuca sancochada. Rico en omega 3.', 2, 15, 25, 'easy',
   '["Sancocha la yuca en agua con sal hasta que esté suave.","En una olla ancha, sofríe el ajo en el aceite y forma una cama con la cebolla, el tomate y el ají.","Coloca encima las postas de jurel sazonadas con sal, agrega media taza de agua y tapa.","Cocina a fuego medio-bajo 12 a 15 minutos, sin mover, hasta que el pescado esté cocido.","Termina con el culantro y sirve con la yuca y el jugo del sudado."]',
   null, '{marino,"una olla","económica"}', '{high_protein,budget}', '{pescado}', '{lunch}', 'PE', 8.30, 'PEN', 'published', true),
  (null, 'Quinotto de champiñones', 'quinotto-de-champinones', 'Quinua cremosa al estilo risotto con champiñones, espinaca y queso fresco.', 2, 10, 25, 'medium',
   '["Lava bien la quinua y cocínala en dos tazas de agua por 15 minutos.","En una sartén con el aceite, sofríe la cebolla y el ajo; agrega los champiñones y cocina hasta que doren.","Incorpora la quinua cocida, la leche evaporada y la espinaca; mueve 3 minutos hasta que quede cremoso.","Apaga el fuego, añade el queso y la sal, mezcla y sirve."]',
   null, '{vegetariano,cremoso}', '{vegetarian,budget}', '{lactosa}', '{lunch,dinner}', 'PE', 8.00, 'PEN', 'published', true),
  (null, 'Ensalada de quinua con garbanzos y palta', 'ensalada-de-quinua-con-garbanzos-y-palta', 'Ensalada completa de quinua, garbanzos, palta y verduras con aliño de limón.', 2, 15, 15, 'easy',
   '["Lava la quinua y cocínala en agua 15 minutos; escúrrela y deja enfriar.","Mezcla el limón, el aceite y la sal en un bowl grande.","Agrega la quinua, los garbanzos, el tomate, el pepino, la cebolla y el culantro; mezcla.","Añade la palta al final para que no se deshaga. Se conserva un día en refrigeración sin la palta."]',
   null, '{vegano,fresco,"meal prep"}', '{vegetarian,vegan,budget}', '{}', '{lunch,dinner}', 'PE', 5.00, 'PEN', 'published', true),
  (null, 'Trucha a la plancha con camote', 'trucha-a-la-plancha-con-camote', 'Filetes de trucha a la plancha con ajo y limón, camote sancochado y ensalada fresca.', 2, 10, 25, 'easy',
   '["Sancocha el camote hasta que esté suave.","Sazona la trucha con el ajo, la sal y la mitad del limón.","Calienta una plancha o sartén con el aceite y cocina la trucha 3 minutos por el lado de la piel y 2 por el otro.","Prepara la ensalada con lechuga, tomate, pepino y el resto del limón. Sirve todo junto."]',
   null, '{marino,plancha}', '{high_protein}', '{pescado}', '{lunch,dinner}', 'PE', 10.80, 'PEN', 'published', true),
  (null, 'Tallarines verdes con pollo', 'tallarines-verdes-con-pollo', 'Tallarines con salsa de albahaca y espinaca hecha con leche evaporada light, y pechuga a la plancha.', 4, 20, 25, 'medium',
   '["Blanquea la espinaca y la albahaca 30 segundos en agua hirviendo y pásalas a agua fría.","Sofríe la cebolla y el ajo con la mitad del aceite.","Licúa las hojas con el sofrito, el queso, la leche evaporada, las nueces y la sal hasta tener una salsa lisa.","Cocina los fideos al dente. Mientras, cocina los filetes a la plancha con el resto del aceite.","Mezcla los fideos con la salsa a fuego bajo 1 minuto y sirve con el pollo."]',
   null, '{"clásico peruano","versión ligera","para la familia"}', '{high_protein,budget}', '{gluten,lactosa,frutos_secos}', '{lunch}', 'PE', 18.50, 'PEN', 'published', true),
  (null, 'Estofado de pollo con papa', 'estofado-de-pollo-con-papa', 'Pierna de pollo guisada en salsa de tomate con papa, zanahoria y arvejas.', 4, 20, 45, 'easy',
   '["Dora las presas en una olla con el aceite y resérvalas.","En la misma olla prepara el aderezo con la cebolla, el ajo y el ají panca.","Agrega el tomate licuado y cocina 5 minutos; regresa el pollo con una taza de agua y la sal.","Añade la papa y la zanahoria; tapa y cocina a fuego bajo 30 minutos.","Agrega las arvejas los últimos 5 minutos y sirve."]',
   null, '{guiso,"una olla","para la familia"}', '{high_protein,budget}', '{}', '{lunch}', 'PE', 14.50, 'PEN', 'published', true),
  (null, 'Chaufa de quinua con pollo', 'chaufa-de-quinua-con-pollo', 'Chaufa preparado con quinua en lugar de arroz, con pollo, huevo, cebolla china y kion.', 2, 15, 20, 'medium',
   '["Cocina la quinua lavada en agua 15 minutos, escúrrela y extiéndela para que se enfríe y se seque.","Bate los huevos y haz una tortilla delgada; córtala en tiras.","En un wok bien caliente con el aceite saltea el pollo hasta dorar; agrega el kion, el ajo y el pimiento.","Incorpora la quinua y el sillao, saltea 2 minutos y termina con la tortilla y la cebolla china."]',
   null, '{chifa,"versión ligera"}', '{high_protein,budget}', '{gluten,huevo,soya}', '{lunch,dinner}', 'PE', 7.90, 'PEN', 'published', true),
  (null, 'Saltado de pota', 'saltado-de-pota', 'Pota salteada al estilo saltado con cebolla, tomate y ají, acompañada de arroz integral.', 2, 15, 35, 'easy',
   '["Cocina el arroz integral con el doble de agua, tapado y a fuego bajo, unos 35 minutos.","Sancocha la pota 5 minutos en agua hirviendo para suavizarla; escúrrela y sécala.","Saltea la pota con el ajo en un wok muy caliente con el aceite.","Agrega la cebolla y el ají, luego el tomate, el sillao y el vinagre. Saltea 1 minuto y termina con culantro.","Sirve con el arroz."]',
   null, '{marino,"económica"}', '{high_protein,budget}', '{gluten,mariscos,soya}', '{lunch}', 'PE', 6.00, 'PEN', 'published', true),
  (null, 'Causa de atún ligera', 'causa-de-atun-ligera', 'Causa de papa amarilla rellena de atún con yogurt griego en vez de mayonesa, palta y huevo.', 4, 25, 25, 'medium',
   '["Sancocha la papa amarilla, pélala y prénsala aún tibia.","Amasa el puré con el ají, el limón, el aceite y la sal hasta que quede suave.","Mezcla el atún con el yogurt griego y la cebolla.","En un molde, coloca una capa de papa, el relleno de atún, la palta y otra capa de papa.","Refrigera 15 minutos, desmolda y decora con el huevo en rodajas."]',
   null, '{"clásico peruano","versión ligera","sin horno"}', '{high_protein}', '{lactosa,huevo,pescado}', '{lunch}', 'PE', 21.00, 'PEN', 'published', true),
  (null, 'Solterito arequipeño', 'solterito-arequipeno', 'Ensalada arequipeña de habas, choclo, queso fresco, tomate y rocoto con aceitunas.', 3, 20, 15, 'easy',
   '["Sancocha las habas y el choclo; deja enfriar y pela las habas.","Lava la cebolla picada con agua fría y escúrrela.","Junta en un bowl las habas, el choclo, el queso, el tomate, la cebolla, el rocoto y las aceitunas.","Aliña con el aceite, el vinagre y la sal; mezcla y termina con culantro."]',
   null, '{tradicional,fresco,vegetariano}', '{vegetarian,budget}', '{lactosa}', '{lunch,dinner}', 'PE', 7.60, 'PEN', 'published', true),
  (null, 'Sopa de quinua con verduras', 'sopa-de-quinua-con-verduras', 'Sopa andina de quinua con papa, zapallo, vainita y queso fresco.', 4, 15, 35, 'easy',
   '["Lava bien la quinua.","Sofríe la cebolla y el ajo con el aceite en una olla.","Agrega 6 tazas de agua, la quinua, la papa, la zanahoria, el zapallo y el apio; cocina 20 minutos.","Añade la vainita y la sal; cocina 8 minutos más.","Sirve con el queso fresco en cubos."]',
   null, '{sopa,"una olla",tradicional}', '{vegetarian,budget}', '{lactosa}', '{lunch,dinner}', 'PE', 5.30, 'PEN', 'published', true),
  (null, 'Caldo de pollo con verduras', 'caldo-de-pollo-con-verduras', 'Caldo casero de pierna de pollo sin piel con papa, zanahoria, fideos y kion.', 4, 15, 50, 'easy',
   '["Pon el pollo en una olla con 2 litros de agua fría, el apio, el kion y la parte blanca de la cebolla china.","Lleva a hervor, retira la espuma y cocina a fuego bajo 30 minutos.","Agrega la papa y la zanahoria en trozos; cocina 12 minutos.","Añade los fideos y la sal; cocina hasta que estén suaves.","Sirve con la parte verde de la cebolla china picada."]',
   null, '{sopa,"una olla",reconfortante}', '{high_protein,budget}', '{gluten}', '{dinner,lunch}', 'PE', 10.60, 'PEN', 'published', true),
  (null, 'Ensalada de pollo con palta', 'ensalada-de-pollo-con-palta', 'Ensalada completa con pechuga a la plancha, palta, lechuga, tomate y pepino.', 2, 10, 12, 'easy',
   '["Sazona los filetes con sal y cocínalos a la plancha 5 o 6 minutos por lado. Déjalos reposar y córtalos en tiras.","Corta la lechuga, el tomate, el pepino y la palta.","Aliña con el limón, el aceite y una pizca de sal.","Sirve las verduras con el pollo encima."]',
   null, '{fresco,plancha}', '{high_protein,low_carb,budget}', '{}', '{lunch,dinner}', 'PE', 8.80, 'PEN', 'published', true),
  (null, 'Crema de zapallo', 'crema-de-zapallo', 'Crema suave de zapallo macre con papa, leche descremada y queso fresco.', 3, 10, 25, 'easy',
   '["Sofríe la cebolla y el ajo con el aceite.","Agrega el zapallo, la papa y 2 tazas de agua; cocina 20 minutos hasta que todo esté suave.","Licúa con la leche y la sal hasta que quede liso.","Calienta de nuevo sin dejar que hierva y sirve con el queso fresco en cubos."]',
   null, '{crema,reconfortante}', '{vegetarian,budget}', '{lactosa}', '{dinner}', 'PE', 5.00, 'PEN', 'published', true),
  (null, 'Caballa al horno con papas', 'caballa-al-horno-con-papas', 'Caballa al horno sobre cama de papa, cebolla y tomate. Pescado azul económico y rico en omega 3.', 2, 15, 35, 'easy',
   '["Precalienta el horno a 200 °C.","Acomoda la papa en una fuente con la mitad del aceite y sal; hornea 15 minutos.","Sazona la caballa con ajo, limón y sal.","Coloca la cebolla, el tomate y la caballa sobre las papas, rocía el resto del aceite y hornea 15 a 18 minutos más."]',
   null, '{marino,"al horno","económica"}', '{high_protein,budget}', '{pescado}', '{lunch,dinner}', 'PE', 7.30, 'PEN', 'published', true),
  (null, 'Omelette de claras con champiñones', 'omelette-de-claras-con-champinones', 'Omelette de claras con un huevo entero, champiñones y espinaca. Mucha proteína y pocos carbohidratos.', 1, 5, 8, 'easy',
   '["Saltea la cebolla y los champiñones con el aceite en una sartén antiadherente; agrega la espinaca al final.","Bate las claras con el huevo y la sal.","Vierte el batido sobre las verduras, baja el fuego y tapa 3 minutos.","Dobla el omelette por la mitad y sirve."]',
   null, '{"cena ligera","rápida"}', '{vegetarian,high_protein,low_carb,budget,quick}', '{huevo}', '{breakfast,dinner}', 'PE', 4.10, 'PEN', 'published', true),
  (null, 'Ensalada tibia de lentejas', 'ensalada-tibia-de-lentejas', 'Lentejas tibias con tomate, pepino, pimiento y aliño de limón.', 2, 15, 25, 'easy',
   '["Cocina las lentejas en agua sin sal 20 a 25 minutos, cuidando que no se deshagan. Escúrrelas.","Mezcla el limón, el aceite y la sal.","Junta las lentejas tibias con las verduras y el aliño; termina con culantro."]',
   null, '{vegano,"económica","meal prep"}', '{vegetarian,vegan,budget}', '{}', '{lunch,dinner}', 'PE', 3.20, 'PEN', 'published', true),
  (null, 'Saltado de tofu con verduras', 'saltado-de-tofu-con-verduras', 'Tofu dorado salteado con brócoli, pimiento, kion y sillao, con arroz integral.', 2, 15, 35, 'easy',
   '["Cocina el arroz integral con el doble de agua, tapado y a fuego bajo, unos 35 minutos.","Seca el tofu con papel y dóralo en el wok con la mitad del aceite; resérvalo.","Saltea el brócoli, el pimiento y la cebolla con el resto del aceite, el kion y el ajo, 3 minutos a fuego alto.","Regresa el tofu, agrega el sillao, mezcla y sirve con el arroz."]',
   null, '{vegano,chifa}', '{vegetarian,vegan}', '{gluten,soya}', '{lunch,dinner}', 'PE', 10.00, 'PEN', 'published', true),
  (null, 'Fruta con yogurt y linaza', 'fruta-con-yogurt-y-linaza', 'Papaya y piña picadas con yogurt natural sin azúcar y linaza.', 1, 5, 0, 'easy',
   '["Pica la fruta en cubos.","Sirve el yogurt en un bowl, agrega la fruta y espolvorea la linaza molida."]',
   null, '{"sin cocción","rápida"}', '{vegetarian,budget,quick}', '{lactosa}', '{snack,breakfast}', 'PE', 2.80, 'PEN', 'published', true),
  (null, 'Batido de plátano y maní', 'batido-de-platano-y-mani', 'Batido de plátano con leche descremada, yogurt griego, mantequilla de maní y avena.', 1, 5, 0, 'easy',
   '["Pon todos los ingredientes en la licuadora.","Licúa 1 minuto hasta que quede cremoso. Si lo quieres más frío, agrega hielo."]',
   null, '{"post entrenamiento","rápida"}', '{vegetarian,high_protein,quick}', '{gluten,lactosa,mani}', '{snack,breakfast}', 'PE', 5.20, 'PEN', 'published', true),
  (null, 'Hummus con palitos de verduras', 'hummus-con-palitos-de-verduras', 'Hummus casero de garbanzo con limón y ajo, sin tahini, con bastones de zanahoria y pepino.', 4, 15, 0, 'easy',
   '["Licúa o procesa los garbanzos con el limón, el ajo, el aceite, la sal y 3 o 4 cucharadas de agua fría hasta que quede liso.","Prueba y ajusta la sal o el limón. Puedes añadir comino o ají panca molido.","Sirve con los bastones de zanahoria y pepino."]',
   null, '{vegano,"para compartir","sin cocción"}', '{vegetarian,vegan,budget,quick}', '{}', '{snack}', 'PE', 3.60, 'PEN', 'published', true),
  (null, 'Pudín de chía con mango', 'pudin-de-chia-con-mango', 'Chía hidratada en leche descremada con mango y un toque de miel. Necesita al menos 4 horas de reposo.', 2, 10, 0, 'easy',
   '["Mezcla la chía con la leche y la miel; deja reposar 10 minutos y vuelve a mezclar para que no se formen grumos.","Tapa y refrigera al menos 4 horas o toda la noche.","Sirve en vasos con el mango en cubos encima."]',
   null, '{"sin cocción","se prepara la noche anterior"}', '{vegetarian,budget}', '{lactosa}', '{breakfast,snack}', 'PE', 4.20, 'PEN', 'published', true),
  (null, 'Choclo con queso', 'choclo-con-queso', 'El clásico choclo sancochado con queso fresco, porción individual.', 1, 5, 20, 'easy',
   '["Sancocha el choclo en agua hirviendo sin sal 15 a 20 minutos (puedes agregar una pizca de azúcar al agua).","Sirve caliente con las tajadas de queso fresco."]',
   null, '{tradicional,"económica"}', '{vegetarian,budget}', '{lactosa}', '{snack}', 'PE', 2.70, 'PEN', 'published', true);

-- ===============================================================================================
-- Ingredientes (gramos reales; display_* es lo que ve la persona)
-- ===============================================================================================

-- Avena con plátano y chía · 1 porción(es) · por porción aprox. 391 kcal, 16.7 g proteína, 69.4 g carbos, 6.9 g grasa · costo ref. S/ 2.52 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'avena-con-platano-y-chia'), (select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), 40, 0.5, 'taza', null, 1),
  ((select id from public.recipes where slug = 'avena-con-platano-y-chia'), (select id from public.foods where name_normalized = 'leche descremada' and created_by is null), 245, 1, 'taza', null, 2),
  ((select id from public.recipes where slug = 'avena-con-platano-y-chia'), (select id from public.foods where name_normalized = 'platano de seda' and created_by is null), 110, 1, 'unidad mediana', null, 3),
  ((select id from public.recipes where slug = 'avena-con-platano-y-chia'), (select id from public.foods where name_normalized = 'chia' and created_by is null), 12, 1, 'cucharada', null, 4);

-- Pan integral con palta y huevo · 1 porción(es) · por porción aprox. 375 kcal, 21.1 g proteína, 31.2 g carbos, 18.9 g grasa · costo ref. S/ 2.59 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'pan-integral-con-palta-y-huevo'), (select id from public.foods where name_normalized = 'pan de molde integral' and created_by is null), 56, 2, 'tajadas', null, 1),
  ((select id from public.recipes where slug = 'pan-integral-con-palta-y-huevo'), (select id from public.foods where name_normalized = 'palta' and created_by is null), 50, 0.25, 'unidad', null, 2),
  ((select id from public.recipes where slug = 'pan-integral-con-palta-y-huevo'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 100, 2, 'unidades', null, 3),
  ((select id from public.recipes where slug = 'pan-integral-con-palta-y-huevo'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 60, 0.5, 'unidad', 'en rodajas', 4),
  ((select id from public.recipes where slug = 'pan-integral-con-palta-y-huevo'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 0.5, 1, 'pizca', null, 5);

-- Revuelto de huevos con espinaca · 1 porción(es) · por porción aprox. 254 kcal, 22.2 g proteína, 7.6 g carbos, 15.0 g grasa · costo ref. S/ 2.57 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 100, 2, 'unidades', null, 1),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'clara de huevo' and created_by is null), 66, 2, 'claras', null, 2),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'espinaca' and created_by is null), 60, 2, 'tazas', null, 3),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 60, 0.5, 'unidad', 'picado', 4),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 20, 2, 'cucharadas', 'picada', 5),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 5, 1, 'cucharadita', null, 6),
  ((select id from public.recipes where slug = 'revuelto-de-huevos-con-espinaca'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 0.5, 1, 'pizca', null, 7);

-- Quinua con manzana · 4 porción(es) · por porción aprox. 149 kcal, 3.1 g proteína, 32.6 g carbos, 1.4 g grasa · costo ref. S/ 0.67 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'quinua-con-manzana'), (select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), 80, 0.5, 'taza', null, 1),
  ((select id from public.recipes where slug = 'quinua-con-manzana'), (select id from public.foods where name_normalized = 'manzana' and created_by is null), 360, 2, 'unidades medianas', 'picada con cáscara', 2),
  ((select id from public.recipes where slug = 'quinua-con-manzana'), (select id from public.foods where name_normalized = 'azucar rubia' and created_by is null), 30, 2.5, 'cucharadas', null, 3);

-- Yogurt griego con fresas y chía · 1 porción(es) · por porción aprox. 211 kcal, 20.0 g proteína, 24.3 g carbos, 4.6 g grasa · costo ref. S/ 5.44 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'yogurt-griego-con-fresas-y-chia'), (select id from public.foods where name_normalized = 'yogurt griego natural sin grasa' and created_by is null), 170, 1, 'envase', null, 1),
  ((select id from public.recipes where slug = 'yogurt-griego-con-fresas-y-chia'), (select id from public.foods where name_normalized = 'fresa' and created_by is null), 96, 8, 'unidades', null, 2),
  ((select id from public.recipes where slug = 'yogurt-griego-con-fresas-y-chia'), (select id from public.foods where name_normalized = 'chia' and created_by is null), 12, 1, 'cucharada', null, 3),
  ((select id from public.recipes where slug = 'yogurt-griego-con-fresas-y-chia'), (select id from public.foods where name_normalized = 'miel de abeja' and created_by is null), 7, 1, 'cucharadita', null, 4);

-- Panqueques de avena y plátano · 2 porción(es) · por porción aprox. 353 kcal, 13.8 g proteína, 54.1 g carbos, 10.3 g grasa · costo ref. S/ 1.57 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'panqueques-de-avena-y-platano'), (select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), 80, 1, 'taza', null, 1),
  ((select id from public.recipes where slug = 'panqueques-de-avena-y-platano'), (select id from public.foods where name_normalized = 'platano de seda' and created_by is null), 220, 2, 'unidades', 'bien maduros', 2),
  ((select id from public.recipes where slug = 'panqueques-de-avena-y-platano'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 100, 2, 'unidades', null, 3),
  ((select id from public.recipes where slug = 'panqueques-de-avena-y-platano'), (select id from public.foods where name_normalized = 'leche descremada' and created_by is null), 60, 0.25, 'taza', null, 4),
  ((select id from public.recipes where slug = 'panqueques-de-avena-y-platano'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 5, 1, 'cucharadita', null, 5);

-- Sánguche de pollo y palta · 1 porción(es) · por porción aprox. 348 kcal, 33.2 g proteína, 29.7 g carbos, 10.8 g grasa · costo ref. S/ 3.64 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'pan de molde integral' and created_by is null), 56, 2, 'tajadas', null, 1),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'pechuga de pollo sin piel, a la plancha' and created_by is null), 80, 0.5, 'taza', 'deshilachada', 2),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'palta' and created_by is null), 40, 1, 'tajada gruesa', null, 3),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'lechuga' and created_by is null), 15, 1, 'hoja', null, 4),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 40, 3, 'rodajas', null, 5),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 5, 1, 'cucharadita', null, 6),
  ((select id from public.recipes where slug = 'sanguche-de-pollo-y-palta'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 0.5, 1, 'pizca', null, 7);

-- Saltado de pollo con arroz integral · 2 porción(es) · por porción aprox. 633 kcal, 43.5 g proteína, 88.2 g carbos, 11.4 g grasa · costo ref. S/ 4.34 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), 300, 2, 'filetes', 'en tiras', 1),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'en gajos gruesos', 2),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 180, 1.5, 'unidades', 'en gajos', 3),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 20, 0.5, 'unidad', 'en tiras', 4),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 5),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'sillao (salsa de soya)' and created_by is null), 16, 1, 'cucharada', null, 6),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'vinagre' and created_by is null), 15, 1, 'cucharada', null, 7),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 9),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'papa blanca sancochada' and created_by is null), 300, 2, 'unidades medianas', 'en bastones', 10),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'arroz integral crudo' and created_by is null), 120, 0.66, 'taza', null, 11),
  ((select id from public.recipes where slug = 'saltado-de-pollo-con-arroz-integral'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 12);

-- Ceviche de pescado con camote y choclo · 2 porción(es) · por porción aprox. 319 kcal, 32.9 g proteína, 45.1 g carbos, 2.5 g grasa · costo ref. S/ 6.43 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'perico (dorado), crudo' and created_by is null), 300, 2, 'filetes', 'muy fresco, en cubos', 1),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 120, 0.5, 'taza', 'unos 10 limones', 2),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 120, 0.75, 'unidad', 'en pluma fina', 3),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'rocoto' and created_by is null), 10, 1, 'cucharada', 'picado sin venas', 4),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 5),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 3, 0.5, 'cucharadita', null, 6),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'camote sancochado' and created_by is null), 200, 2, 'trozos medianos', null, 7),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), 150, 1, 'taza', 'desgranado', 8),
  ((select id from public.recipes where slug = 'ceviche-de-pescado-con-camote-y-choclo'), (select id from public.foods where name_normalized = 'lechuga' and created_by is null), 30, 2, 'hojas', null, 9);

-- Arroz con pollo ligero · 4 porción(es) · por porción aprox. 573 kcal, 38.1 g proteína, 75.4 g carbos, 11.9 g grasa · costo ref. S/ 4.02 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'pierna de pollo sin piel, cruda' and created_by is null), 600, 4, 'presas', 'sin piel', 1),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'arroz blanco crudo' and created_by is null), 280, 1.5, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 60, 0.6, 'atado', null, 3),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'espinaca' and created_by is null), 60, 2, 'tazas', null, 4),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'arvejas verdes cocidas' and created_by is null), 120, 0.75, 'taza', null, 5),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 100, 1, 'unidad grande', 'en cubitos', 6),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'pimiento rojo' and created_by is null), 65, 0.5, 'unidad', 'en tiras', 7),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), 100, 0.66, 'taza', 'desgranado', 8),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'picada', 9),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 8, 2, 'dientes', null, 10),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 40, 1, 'unidad', 'licuado', 11),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 20, 1.5, 'cucharadas', null, 12),
  ((select id from public.recipes where slug = 'arroz-con-pollo-ligero'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 5, 1, 'cucharadita', null, 13);

-- Seco de res con frejol canario · 4 porción(es) · por porción aprox. 419 kcal, 41.1 g proteína, 42.2 g carbos, 10.3 g grasa · costo ref. S/ 5.21 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'carne de res magra, cruda' and created_by is null), 500, 500, 'g', 'en trozos', 1),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 60, 0.6, 'atado', null, 2),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'picada', 3),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 8, 2, 'dientes', null, 4),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 40, 1, 'unidad', 'licuado', 5),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'arvejas verdes cocidas' and created_by is null), 100, 0.66, 'taza', null, 6),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 100, 1, 'unidad grande', 'en rodajas', 7),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 15, 1, 'cucharada', null, 8),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 5, 1, 'cucharadita', null, 9),
  ((select id from public.recipes where slug = 'seco-de-res-con-frejol-canario'), (select id from public.foods where name_normalized = 'frejol canario seco' and created_by is null), 200, 1, 'taza', 'remojado desde la noche anterior', 10);

-- Lentejas con arroz y huevo · 4 porción(es) · por porción aprox. 578 kcal, 27.1 g proteína, 95.4 g carbos, 9.9 g grasa · costo ref. S/ 1.53 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'lentejas secas' and created_by is null), 250, 1.25, 'tazas', null, 1),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 120, 1, 'unidad pequeña', 'picada', 2),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 8, 2, 'dientes', null, 3),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 120, 1, 'unidad', 'picado', 4),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 75, 1, 'unidad', 'en cubitos', 5),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'aji panca seco' and created_by is null), 8, 1, 'unidad', 'remojado y licuado', 6),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 15, 1, 'cucharada', null, 7),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 5, 1, 'cucharadita', null, 8),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'arroz blanco crudo' and created_by is null), 240, 1.25, 'tazas', null, 9),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 200, 4, 'unidades', null, 10),
  ((select id from public.recipes where slug = 'lentejas-con-arroz-y-huevo'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 11);

-- Tacu tacu con huevo y ensalada · 2 porción(es) · por porción aprox. 580 kcal, 25.7 g proteína, 88.5 g carbos, 14.0 g grasa · costo ref. S/ 2.01 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'arroz blanco cocido' and created_by is null), 300, 2, 'tazas', 'del día anterior', 1),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'frejol canario cocido' and created_by is null), 300, 1.75, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 60, 0.5, 'unidad pequeña', 'picada', 3),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 4),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 20, 0.5, 'unidad', 'licuado', 5),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 14, 1, 'cucharada', null, 6),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 100, 2, 'unidades', null, 7),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'lechuga' and created_by is null), 60, 1.5, 'tazas', null, 8),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 120, 1, 'unidad', null, 9),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 10, 2, 'cucharaditas', null, 10),
  ((select id from public.recipes where slug = 'tacu-tacu-con-huevo-y-ensalada'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 3, 0.5, 'cucharadita', null, 11);

-- Sudado de jurel con yuca · 2 porción(es) · por porción aprox. 656 kcal, 44.3 g proteína, 69.7 g carbos, 21.5 g grasa · costo ref. S/ 4.16 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'jurel, crudo' and created_by is null), 400, 2, 'postas', null, 1),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'en gajos', 2),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 200, 2, 'unidades', 'en gajos', 3),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 20, 0.5, 'unidad', 'en tiras', 4),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 5),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 8, 0.5, 'taza', 'hojas', 6),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 7),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 3, 0.5, 'cucharadita', null, 8),
  ((select id from public.recipes where slug = 'sudado-de-jurel-con-yuca'), (select id from public.foods where name_normalized = 'yuca cruda' and created_by is null), 300, 3, 'trozos medianos', null, 9);

-- Quinotto de champiñones · 2 porción(es) · por porción aprox. 490 kcal, 23.6 g proteína, 62.6 g carbos, 17.3 g grasa · costo ref. S/ 3.99 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), 150, 0.9, 'taza', null, 1),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'champinones' and created_by is null), 200, 3, 'tazas', 'en láminas', 2),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 80, 0.5, 'unidad', 'picada fina', 3),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 6, 1.5, 'dientes', null, 4),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'espinaca' and created_by is null), 60, 2, 'tazas', null, 5),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'leche evaporada descremada' and created_by is null), 80, 5, 'cucharadas', null, 6),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 60, 2, 'tajadas', 'rallado', 7),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'quinotto-de-champinones'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 9);

-- Ensalada de quinua con garbanzos y palta · 2 porción(es) · por porción aprox. 505 kcal, 18.2 g proteína, 71.7 g carbos, 18.2 g grasa · costo ref. S/ 2.50 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), 100, 0.6, 'taza', null, 1),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'garbanzos cocidos' and created_by is null), 200, 1.25, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'palta' and created_by is null), 100, 0.5, 'unidad', 'en cubos', 3),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 150, 1, 'unidad grande', 'en cubos', 4),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'pepino' and created_by is null), 100, 0.5, 'unidad', 'en cubos', 5),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 40, 0.25, 'unidad', 'picada fina', 6),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 30, 2, 'cucharadas', null, 7),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 9),
  ((select id from public.recipes where slug = 'ensalada-de-quinua-con-garbanzos-y-palta'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 10);

-- Trucha a la plancha con camote · 2 porción(es) · por porción aprox. 391 kcal, 34.8 g proteína, 33.4 g carbos, 13.7 g grasa · costo ref. S/ 5.40 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'trucha, cruda' and created_by is null), 300, 2, 'filetes', null, 1),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 8, 2, 'cucharaditas', null, 2),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 20, 4, 'cucharaditas', null, 3),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', 'molido', 4),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 5),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'camote sancochado' and created_by is null), 300, 3, 'trozos medianos', null, 6),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'lechuga' and created_by is null), 80, 2, 'tazas', null, 7),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 120, 1, 'unidad', null, 8),
  ((select id from public.recipes where slug = 'trucha-a-la-plancha-con-camote'), (select id from public.foods where name_normalized = 'pepino' and created_by is null), 100, 0.5, 'unidad', null, 9);

-- Tallarines verdes con pollo · 4 porción(es) · por porción aprox. 623 kcal, 46.9 g proteína, 69.0 g carbos, 17.1 g grasa · costo ref. S/ 4.62 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'fideos secos' and created_by is null), 320, 4, 'porciones', null, 1),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'espinaca' and created_by is null), 150, 5, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'albahaca' and created_by is null), 60, 2.5, 'tazas', 'solo hojas', 3),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 90, 3, 'tajadas', null, 4),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'leche evaporada descremada' and created_by is null), 150, 0.5, 'taza', null, 5),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 6, 1.5, 'dientes', null, 6),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 60, 0.5, 'unidad pequeña', null, 7),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 15, 1, 'cucharada', null, 8),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'nueces' and created_by is null), 20, 2, 'cucharadas', null, 9),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 4, 0.75, 'cucharadita', null, 10),
  ((select id from public.recipes where slug = 'tallarines-verdes-con-pollo'), (select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), 480, 4, 'filetes', null, 11);

-- Estofado de pollo con papa · 4 porción(es) · por porción aprox. 375 kcal, 34.4 g proteína, 35.5 g carbos, 10.0 g grasa · costo ref. S/ 3.62 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'pierna de pollo sin piel, cruda' and created_by is null), 600, 4, 'presas', 'sin piel', 1),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), 450, 3, 'unidades medianas', 'en mitades', 2),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 150, 2, 'unidades', 'en rodajas', 3),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'arvejas verdes cocidas' and created_by is null), 120, 0.75, 'taza', null, 4),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 240, 2, 'unidades', 'licuados', 5),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'picada', 6),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 8, 2, 'dientes', null, 7),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'aji panca seco' and created_by is null), 8, 1, 'unidad', 'remojado y licuado', 8),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 15, 1, 'cucharada', null, 9),
  ((select id from public.recipes where slug = 'estofado-de-pollo-con-papa'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 4, 0.75, 'cucharadita', null, 10);

-- Chaufa de quinua con pollo · 2 porción(es) · por porción aprox. 516 kcal, 44.8 g proteína, 44.3 g carbos, 16.9 g grasa · costo ref. S/ 3.93 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), 120, 0.75, 'taza', null, 1),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), 250, 2, 'filetes', 'en cubos', 2),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 100, 2, 'unidades', null, 3),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'cebolla china' and created_by is null), 45, 3, 'tallos', null, 4),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'pimiento rojo' and created_by is null), 65, 0.5, 'unidad', 'en cubitos', 5),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'kion (jengibre)' and created_by is null), 6, 3, 'cucharaditas', 'rallado', 6),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 7),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'sillao (salsa de soya)' and created_by is null), 24, 1.5, 'cucharadas', null, 8),
  ((select id from public.recipes where slug = 'chaufa-de-quinua-con-pollo'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 9);

-- Saltado de pota · 2 porción(es) · por porción aprox. 485 kcal, 34.4 g proteína, 63.6 g carbos, 9.7 g grasa · costo ref. S/ 3.00 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'pota, cruda' and created_by is null), 350, 350, 'g', 'limpia, en tiras', 1),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 150, 1, 'unidad', 'en gajos', 2),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 180, 1.5, 'unidades', 'en gajos', 3),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 20, 0.5, 'unidad', 'en tiras', 4),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 5),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'sillao (salsa de soya)' and created_by is null), 16, 1, 'cucharada', null, 6),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'vinagre' and created_by is null), 15, 1, 'cucharada', null, 7),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 9),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'arroz integral crudo' and created_by is null), 120, 0.66, 'taza', null, 10),
  ((select id from public.recipes where slug = 'saltado-de-pota'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 1, 1, 'pizca', null, 11);

-- Causa de atún ligera · 4 porción(es) · por porción aprox. 354 kcal, 24.6 g proteína, 39.9 g carbos, 11.0 g grasa · costo ref. S/ 5.24 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'papa amarilla sancochada' and created_by is null), 600, 5, 'unidades medianas', null, 1),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'aji amarillo' and created_by is null), 30, 2, 'cucharadas', 'licuado', 2),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 30, 2, 'cucharadas', null, 3),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 15, 1, 'cucharada', null, 4),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 4, 0.75, 'cucharadita', null, 5),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'atun en agua, escurrido' and created_by is null), 240, 2, 'latas', null, 6),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'yogurt griego natural sin grasa' and created_by is null), 80, 4, 'cucharadas', null, 7),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 40, 0.25, 'unidad', 'picada fina', 8),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'palta' and created_by is null), 100, 0.5, 'unidad', 'en láminas', 9),
  ((select id from public.recipes where slug = 'causa-de-atun-ligera'), (select id from public.foods where name_normalized = 'huevo sancochado' and created_by is null), 100, 2, 'unidades', null, 10);

-- Solterito arequipeño · 3 porción(es) · por porción aprox. 272 kcal, 13.1 g proteína, 24.0 g carbos, 15.2 g grasa · costo ref. S/ 2.54 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'habas verdes cocidas' and created_by is null), 200, 1.25, 'tazas', 'peladas', 1),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), 150, 1, 'taza', 'desgranado', 2),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 120, 4, 'tajadas', 'en cubos', 3),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 150, 1, 'unidad grande', 'en cubos', 4),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 80, 0.5, 'unidad', 'picada', 5),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'rocoto' and created_by is null), 15, 1.5, 'cucharadas', 'picado sin venas', 6),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'aceituna de botija' and created_by is null), 30, 5, 'unidades', 'sin pepa', 7),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'vinagre' and created_by is null), 10, 2, 'cucharaditas', null, 9),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 10),
  ((select id from public.recipes where slug = 'solterito-arequipeno'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 1, 1, 'pizca', null, 11);

-- Sopa de quinua con verduras · 4 porción(es) · por porción aprox. 270 kcal, 10.0 g proteína, 38.6 g carbos, 9.0 g grasa · costo ref. S/ 1.32 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'quinua cruda' and created_by is null), 100, 0.6, 'taza', null, 1),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), 300, 2, 'unidades medianas', 'en cubos', 2),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 100, 1, 'unidad grande', 'en cubos', 3),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'zapallo macre' and created_by is null), 150, 1, 'trozo', 'en cubos', 4),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'vainita' and created_by is null), 80, 0.75, 'taza', 'picada', 5),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 80, 0.5, 'unidad', 'picada', 6),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 6, 1.5, 'dientes', null, 7),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'apio' and created_by is null), 40, 1, 'tallo', null, 8),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 80, 3, 'tajadas', 'en cubos', 9),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 10),
  ((select id from public.recipes where slug = 'sopa-de-quinua-con-verduras'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 5, 1, 'cucharadita', null, 11);

-- Caldo de pollo con verduras · 4 porción(es) · por porción aprox. 297 kcal, 28.6 g proteína, 31.6 g carbos, 5.2 g grasa · costo ref. S/ 2.66 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'pierna de pollo sin piel, cruda' and created_by is null), 500, 4, 'presas', 'sin piel', 1),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), 300, 2, 'unidades medianas', null, 2),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 100, 1, 'unidad grande', null, 3),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'apio' and created_by is null), 40, 1, 'tallo', null, 4),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'cebolla china' and created_by is null), 30, 2, 'tallos', null, 5),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'fideos secos' and created_by is null), 80, 1, 'porción', null, 6),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'kion (jengibre)' and created_by is null), 6, 1, 'trozo pequeño', null, 7),
  ((select id from public.recipes where slug = 'caldo-de-pollo-con-verduras'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 5, 1, 'cucharadita', null, 8);

-- Ensalada de pollo con palta · 2 porción(es) · por porción aprox. 328 kcal, 36.6 g proteína, 11.6 g carbos, 15.6 g grasa · costo ref. S/ 4.38 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'pechuga de pollo sin piel, cruda' and created_by is null), 300, 2, 'filetes', null, 1),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'lechuga' and created_by is null), 120, 3, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 150, 1, 'unidad grande', null, 3),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'pepino' and created_by is null), 100, 0.5, 'unidad', null, 4),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'palta' and created_by is null), 100, 0.5, 'unidad', null, 5),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 20, 4, 'cucharaditas', null, 6),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 8, 2, 'cucharaditas', null, 7),
  ((select id from public.recipes where slug = 'ensalada-de-pollo-con-palta'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 8);

-- Crema de zapallo · 3 porción(es) · por porción aprox. 209 kcal, 9.3 g proteína, 28.6 g carbos, 7.8 g grasa · costo ref. S/ 1.68 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'zapallo macre' and created_by is null), 600, 4, 'trozos', 'pelado, en cubos', 1),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), 150, 1, 'unidad mediana', null, 2),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 80, 0.5, 'unidad', null, 3),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 4),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'leche descremada' and created_by is null), 200, 0.8, 'taza', null, 5),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 60, 2, 'tajadas', null, 6),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 8, 2, 'cucharaditas', null, 7),
  ((select id from public.recipes where slug = 'crema-de-zapallo'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 3, 0.5, 'cucharadita', null, 8);

-- Caballa al horno con papas · 2 porción(es) · por porción aprox. 515 kcal, 40.7 g proteína, 44.4 g carbos, 19.2 g grasa · costo ref. S/ 3.65 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'caballa, cruda' and created_by is null), 350, 2, 'trozos medianos', null, 1),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'papa blanca cruda' and created_by is null), 400, 3, 'unidades medianas', 'en rodajas', 2),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 100, 0.66, 'unidad', 'en pluma', 3),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 150, 1, 'unidad grande', 'en rodajas', 4),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 20, 4, 'cucharaditas', null, 5),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 6, 1.5, 'dientes', null, 6),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 7),
  ((select id from public.recipes where slug = 'caballa-al-horno-con-papas'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 3, 0.5, 'cucharadita', null, 8);

-- Omelette de claras con champiñones · 1 porción(es) · por porción aprox. 210 kcal, 27.5 g proteína, 6.8 g carbos, 7.9 g grasa · costo ref. S/ 4.13 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'clara de huevo' and created_by is null), 165, 5, 'claras', null, 1),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'huevo de gallina' and created_by is null), 50, 1, 'unidad', null, 2),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'champinones' and created_by is null), 70, 1, 'taza', 'en láminas', 3),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'espinaca' and created_by is null), 30, 1, 'taza', null, 4),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 20, 2, 'cucharadas', 'picada', 5),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 2.5, 0.5, 'cucharadita', null, 6),
  ((select id from public.recipes where slug = 'omelette-de-claras-con-champinones'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 0.5, 1, 'pizca', null, 7);

-- Ensalada tibia de lentejas · 2 porción(es) · por porción aprox. 348 kcal, 20.0 g proteína, 56.4 g carbos, 6.1 g grasa · costo ref. S/ 1.61 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'lentejas secas' and created_by is null), 150, 0.75, 'taza', null, 1),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'tomate' and created_by is null), 120, 1, 'unidad', 'en cubos', 2),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'pepino' and created_by is null), 100, 0.5, 'unidad', 'en cubos', 3),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 40, 0.25, 'unidad', 'picada fina', 4),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'pimiento rojo' and created_by is null), 65, 0.5, 'unidad', 'en cubitos', 5),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 20, 4, 'cucharaditas', null, 6),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 10, 2, 'cucharaditas', null, 7),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'culantro' and created_by is null), 4, 0.25, 'taza', 'picado', 8),
  ((select id from public.recipes where slug = 'ensalada-tibia-de-lentejas'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 9);

-- Saltado de tofu con verduras · 2 porción(es) · por porción aprox. 461 kcal, 21.5 g proteína, 64.9 g carbos, 14.8 g grasa · costo ref. S/ 5.00 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'tofu' and created_by is null), 300, 300, 'g', 'en cubos', 1),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'brocoli' and created_by is null), 180, 2, 'tazas', 'en floretes', 2),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'pimiento rojo' and created_by is null), 130, 1, 'unidad', 'en tiras', 3),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'cebolla roja' and created_by is null), 100, 0.66, 'unidad', 'en gajos', 4),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'kion (jengibre)' and created_by is null), 6, 3, 'cucharaditas', 'rallado', 5),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 6),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'sillao (salsa de soya)' and created_by is null), 24, 1.5, 'cucharadas', null, 7),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'aceite vegetal' and created_by is null), 10, 2, 'cucharaditas', null, 8),
  ((select id from public.recipes where slug = 'saltado-de-tofu-con-verduras'), (select id from public.foods where name_normalized = 'arroz integral crudo' and created_by is null), 120, 0.66, 'taza', null, 9);

-- Fruta con yogurt y linaza · 1 porción(es) · por porción aprox. 250 kcal, 8.2 g proteína, 36.7 g carbos, 9.6 g grasa · costo ref. S/ 2.79 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'fruta-con-yogurt-y-linaza'), (select id from public.foods where name_normalized = 'papaya' and created_by is null), 145, 1, 'taza', 'en cubos', 1),
  ((select id from public.recipes where slug = 'fruta-con-yogurt-y-linaza'), (select id from public.foods where name_normalized = 'pina' and created_by is null), 85, 0.5, 'taza', 'en cubos', 2),
  ((select id from public.recipes where slug = 'fruta-con-yogurt-y-linaza'), (select id from public.foods where name_normalized = 'yogurt natural sin azucar' and created_by is null), 150, 0.6, 'taza', null, 3),
  ((select id from public.recipes where slug = 'fruta-con-yogurt-y-linaza'), (select id from public.foods where name_normalized = 'linaza' and created_by is null), 10, 1, 'cucharada', 'molida', 4);

-- Batido de plátano y maní · 1 porción(es) · por porción aprox. 410 kcal, 26.3 g proteína, 57.5 g carbos, 10.3 g grasa · costo ref. S/ 5.16 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'batido-de-platano-y-mani'), (select id from public.foods where name_normalized = 'platano de seda' and created_by is null), 110, 1, 'unidad mediana', null, 1),
  ((select id from public.recipes where slug = 'batido-de-platano-y-mani'), (select id from public.foods where name_normalized = 'leche descremada' and created_by is null), 245, 1, 'taza', null, 2),
  ((select id from public.recipes where slug = 'batido-de-platano-y-mani'), (select id from public.foods where name_normalized = 'yogurt griego natural sin grasa' and created_by is null), 100, 5, 'cucharadas', null, 3),
  ((select id from public.recipes where slug = 'batido-de-platano-y-mani'), (select id from public.foods where name_normalized = 'mantequilla de mani' and created_by is null), 16, 1, 'cucharada', null, 4),
  ((select id from public.recipes where slug = 'batido-de-platano-y-mani'), (select id from public.foods where name_normalized = 'avena en hojuelas' and created_by is null), 20, 0.25, 'taza', null, 5);

-- Hummus con palitos de verduras · 4 porción(es) · por porción aprox. 178 kcal, 6.4 g proteína, 24.7 g carbos, 6.8 g grasa · costo ref. S/ 0.89 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'garbanzos cocidos' and created_by is null), 250, 1.5, 'tazas', null, 1),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'limon, jugo' and created_by is null), 30, 2, 'cucharadas', null, 2),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'ajo' and created_by is null), 4, 1, 'diente', null, 3),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'aceite de oliva' and created_by is null), 20, 1.5, 'cucharadas', null, 4),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'sal de mesa' and created_by is null), 2, 1, 'pizca generosa', null, 5),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'zanahoria' and created_by is null), 200, 3, 'unidades', 'en bastones', 6),
  ((select id from public.recipes where slug = 'hummus-con-palitos-de-verduras'), (select id from public.foods where name_normalized = 'pepino' and created_by is null), 200, 1, 'unidad', 'en bastones', 7);

-- Pudín de chía con mango · 2 porción(es) · por porción aprox. 229 kcal, 9.2 g proteína, 36.6 g carbos, 6.6 g grasa · costo ref. S/ 2.11 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'pudin-de-chia-con-mango'), (select id from public.foods where name_normalized = 'chia' and created_by is null), 40, 3.5, 'cucharadas', null, 1),
  ((select id from public.recipes where slug = 'pudin-de-chia-con-mango'), (select id from public.foods where name_normalized = 'leche descremada' and created_by is null), 300, 1.25, 'tazas', null, 2),
  ((select id from public.recipes where slug = 'pudin-de-chia-con-mango'), (select id from public.foods where name_normalized = 'mango' and created_by is null), 200, 1.25, 'tazas', 'en cubos', 3),
  ((select id from public.recipes where slug = 'pudin-de-chia-con-mango'), (select id from public.foods where name_normalized = 'miel de abeja' and created_by is null), 14, 2, 'cucharaditas', null, 4);

-- Choclo con queso · 1 porción(es) · por porción aprox. 371 kcal, 17.7 g proteína, 43.7 g carbos, 17.3 g grasa · costo ref. S/ 2.70 por porción
insert into public.recipe_ingredients (recipe_id, food_id, grams, display_quantity, display_unit, note, position)
values
  ((select id from public.recipes where slug = 'choclo-con-queso'), (select id from public.foods where name_normalized = 'choclo cocido' and created_by is null), 200, 1, 'choclo mediano', null, 1),
  ((select id from public.recipes where slug = 'choclo-con-queso'), (select id from public.foods where name_normalized = 'queso fresco' and created_by is null), 60, 2, 'tajadas', null, 2);

commit;
