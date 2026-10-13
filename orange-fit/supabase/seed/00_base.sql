-- ORANGE FIT · Seed base (se aplica con `supabase db reset` después de las migraciones).
-- Contiene solo datos de configuración y contenido propio. Alimentos, recetas y precios
-- referenciales viven en supabase/seed-pending/ (otro flujo): NO se cargan aquí.
-- Es idempotente: se puede volver a ejecutar sin duplicar filas.

-- ---------------------------------------------------------------------------
-- Planes
-- ---------------------------------------------------------------------------
insert into public.plans (id, name, description, features, ai_monthly_limits, is_active, sort_order)
values
  (
    'free',
    'Gratis',
    'Registro manual de comidas, panel diario, macros, agua y seguimiento básico.',
    array['manual_logging', 'dashboard', 'macros', 'water', 'basic_tracking'],
    '{"photo": 0, "text": 0, "voice": 0, "chat": 0}'::jsonb,
    true,
    0
  ),
  (
    'premium',
    'Premium',
    'Todo lo del plan gratis más registro con IA (foto, voz y texto), asistente, planes de comidas, '
      'recetas inteligentes, lista de compras, analítica avanzada y exportaciones.',
    array[
      'manual_logging', 'dashboard', 'macros', 'water', 'basic_tracking',
      'ai_photo', 'ai_voice', 'ai_text', 'assistant', 'meal_plans', 'smart_recipes',
      'shopping_list', 'advanced_analytics', 'exports'
    ],
    '{"photo": 120, "text": 300, "voice": 300, "chat": 400}'::jsonb,
    true,
    1
  )
on conflict (id) do update
  set name = excluded.name,
      description = excluded.description,
      features = excluded.features,
      ai_monthly_limits = excluded.ai_monthly_limits,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Precios de Premium
-- OJO: son valores INICIALES de referencia, editables desde el panel admin. No son precios
-- definitivos ni están conectados a Stripe/Mercado Pago hasta completar stripe_price_id /
-- mercadopago_plan_id.
-- PEN: S/ 29.90 al mes y S/ 199.90 al año. USD: 7.99 al mes y 54.99 al año. Prueba de 7 días.
-- ---------------------------------------------------------------------------
insert into public.plan_prices (plan_id, interval, currency_code, amount_cents, trial_days, is_active)
values
  ('premium', 'month', 'PEN', 2990, 7, true),
  ('premium', 'year', 'PEN', 19990, 7, true),
  ('premium', 'month', 'USD', 799, 7, true),
  ('premium', 'year', 'USD', 5499, 7, true)
on conflict (plan_id, interval, currency_code) where is_active do nothing;

-- ---------------------------------------------------------------------------
-- Ajustes de la app
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description, is_public)
values
  ('app_name', '"ORANGE FIT"'::jsonb, 'Nombre visible de la app.', true),
  (
    'support_email',
    '"soporte@example.com"'::jsonb,
    'CAMBIAR ANTES DE PRODUCCIÓN: correo real de soporte. example.com es un marcador de posición.',
    true
  ),
  (
    'feature_flags',
    '{
      "ai_photo": true,
      "ai_text": true,
      "ai_voice": true,
      "assistant": true,
      "barcode_scanner": true,
      "meal_plans": true,
      "shopping_list": true,
      "challenges": true,
      "push_notifications": true,
      "payments_stripe": true,
      "payments_mercadopago": false
    }'::jsonb,
    'Interruptores de funciones. Un flag en true no basta: el servicio también necesita sus credenciales.',
    true
  ),
  ('default_trial_days', '7'::jsonb, 'Días de prueba por defecto para Premium.', true),
  ('maintenance_banner', 'null'::jsonb, 'Texto del aviso de mantenimiento; null = sin aviso.', true)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Micronutrientes (los 8 núcleo viven como columnas en foods)
-- ---------------------------------------------------------------------------
insert into public.nutrient_definitions (code, name_es, unit)
values
  ('vitamin_a_rae', 'Vitamina A (RAE)', 'µg'),
  ('vitamin_c', 'Vitamina C', 'mg'),
  ('vitamin_d', 'Vitamina D', 'µg'),
  ('vitamin_e', 'Vitamina E', 'mg'),
  ('vitamin_k', 'Vitamina K', 'µg'),
  ('thiamin', 'Tiamina (B1)', 'mg'),
  ('riboflavin', 'Riboflavina (B2)', 'mg'),
  ('niacin', 'Niacina (B3)', 'mg'),
  ('vitamin_b6', 'Vitamina B6', 'mg'),
  ('folate_dfe', 'Folato (DFE)', 'µg'),
  ('vitamin_b12', 'Vitamina B12', 'µg'),
  ('calcium', 'Calcio', 'mg'),
  ('iron', 'Hierro', 'mg'),
  ('magnesium', 'Magnesio', 'mg'),
  ('phosphorus', 'Fósforo', 'mg'),
  ('potassium', 'Potasio', 'mg'),
  ('zinc', 'Zinc', 'mg'),
  ('selenium', 'Selenio', 'µg'),
  ('cholesterol', 'Colesterol', 'mg')
on conflict (code) do update
  set name_es = excluded.name_es,
      unit = excluded.unit;

-- ---------------------------------------------------------------------------
-- Insignias: solo celebran lo que sí hiciste (nunca castigan días sin registro).
-- criteria es la regla que evalúa la app; los días no tienen que ser consecutivos.
-- ---------------------------------------------------------------------------
insert into public.badges (code, name, description, icon, criteria, is_active)
values
  ('first_log', 'Primer registro', 'Registraste tu primera comida. ¡Buen comienzo!', 'sparkles',
    '{"type": "meal_log_items_total", "min": 1}', true),
  ('logging_days_7', '7 días registrando', 'Registraste comidas en 7 días distintos.', 'calendar-check',
    '{"type": "logging_days", "days": 7}', true),
  ('logging_days_30', '30 días registrando', 'Registraste comidas en 30 días distintos.', 'medal',
    '{"type": "logging_days", "days": 30}', true),
  ('hydration_days_5', 'Hidratación 5 días', 'Llegaste a tu meta de agua en 5 días distintos.', 'droplets',
    '{"type": "water_goal_days", "days": 5}', true),
  ('protein_goal_days_5', 'Proteína en meta 5 días', 'Alcanzaste tu meta de proteína en 5 días distintos.', 'drumstick',
    '{"type": "protein_goal_days", "days": 5}', true),
  ('first_recipe', 'Primera receta', 'Creaste tu primera receta.', 'chef-hat',
    '{"type": "recipes_created", "min": 1}', true),
  ('first_weight', 'Primer peso', 'Registraste tu peso por primera vez.', 'scale',
    '{"type": "weight_logs_total", "min": 1}', true),
  ('first_barcode', 'Primer escaneo', 'Registraste un alimento escaneando su código de barras.', 'scan-barcode',
    '{"type": "log_source_used", "source": "barcode", "min": 1}', true),
  ('first_meal_plan', 'Primer plan semanal', 'Armaste tu primer plan de comidas.', 'calendar-days',
    '{"type": "meal_plans_created", "min": 1}', true),
  ('veggies_days_5', 'Verduras 5 días', 'Registraste verduras en 5 días distintos.', 'carrot',
    '{"type": "vegetable_days", "days": 5}', true),
  ('first_challenge', 'Primer reto', 'Completaste tu primer reto voluntario.', 'trophy',
    '{"type": "challenges_completed", "min": 1}', true)
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      criteria = excluded.criteria,
      is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Retos voluntarios. target_value es la meta diaria; duration_days, cuántos días sumar.
-- Si un día no se logra, no se pierde nada: se sigue sumando al retomar.
-- ---------------------------------------------------------------------------
insert into public.challenges (code, title, description, kind, target_value, duration_days, is_active)
values
  ('water_7_days', '7 días bien hidratado',
    'Toma al menos 2 litros de agua (o tu meta de agua) durante 7 días. Ajusta la meta si tu profesional de salud te indicó otra.',
    'water', 2000, 7, true),
  ('logging_14_days', 'Registra 14 días',
    'Registra al menos una comida al día hasta sumar 14 días. No importa si te saltas alguno: sigues desde donde ibas.',
    'logging', 1, 14, true),
  ('breakfast_10_days', 'Desayuno en el diario',
    'Registra tu desayuno durante 10 días para conocer mejor cómo empiezas el día.',
    'logging', 1, 10, true),
  ('protein_7_days', 'Proteína en meta',
    'Llega al 100 % de tu meta de proteína en 7 días.',
    'protein', 100, 7, true),
  ('vegetables_7_days', 'Más verduras',
    'Incluye 3 porciones de verduras al día durante 7 días.',
    'vegetables', 3, 7, true),
  ('move_7_days', 'Muévete 30 minutos',
    'Suma 30 minutos de actividad que disfrutes (caminar cuenta) durante 7 días.',
    'activity', 30, 7, true)
on conflict (code) do update
  set title = excluded.title,
      description = excluded.description,
      kind = excluded.kind,
      target_value = excluded.target_value,
      duration_days = excluded.duration_days,
      is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- Contenido: preguntas frecuentes (publicadas)
-- ---------------------------------------------------------------------------
insert into public.content_pages (slug, title, body_md, kind, status, sort_order)
values
  ('faq-que-es-orange-fit', '¿Qué es ORANGE FIT?',
$md$ORANGE FIT es una app para registrar lo que comes, ver tus calorías y macronutrientes, y seguir tu agua, peso y hábitos en un solo lugar. Te ayuda a entender tus números para que tomes mejores decisiones a tu ritmo, sin dietas extremas ni castigos.$md$,
    'faq', 'published', 10),

  ('faq-reemplaza-profesional', '¿ORANGE FIT reemplaza a un nutricionista o médico?',
$md$No. ORANGE FIT es una herramienta de registro y educación, no un servicio médico. Los cálculos son estimaciones generales y no consideran todo tu historial de salud.

Si tienes una condición de salud, tomas medicamentos, estás embarazada o dando de lactar, o tienes antecedentes de trastornos de la conducta alimentaria, consulta con un profesional de salud antes de cambiar tu alimentación.$md$,
    'faq', 'published', 20),

  ('faq-como-calcula-calorias', '¿Cómo calcula mis calorías y macros?',
$md$Usamos la ecuación de Mifflin-St Jeor para estimar tu gasto en reposo y la ajustamos según tu nivel de actividad y tu objetivo. Luego repartimos la energía en proteína, carbohidratos y grasas.

Es un punto de partida: el cuerpo de cada persona responde distinto. Revisa tu evolución durante algunas semanas y ajusta con calma. La app no te propone metas por debajo de mínimos de seguridad.$md$,
    'faq', 'published', 30),

  ('faq-origen-datos-alimentos', '¿De dónde salen los datos de los alimentos?',
$md$Cada alimento muestra su procedencia: bases de datos públicas (como FoodData Central del USDA u Open Food Facts), alimentos revisados por nuestro equipo o alimentos que creaste tú.

Los valores son por 100 g y pueden variar según la marca, la variedad o la preparación. Si encuentras un dato que no cuadra, avísanos para revisarlo.$md$,
    'faq', 'published', 40),

  ('faq-precision-ia', '¿Qué tan precisa es la foto o la voz con IA?',
$md$La IA solo propone qué alimentos ves y en qué cantidad aproximada; los nutrientes salen de nuestra base de alimentos. Aun así, es una estimación: las porciones en una foto pueden engañar.

Nada se registra sin que lo confirmes. Siempre puedes corregir el alimento o la cantidad antes de guardar.$md$,
    'faq', 'published', 50),

  ('faq-que-incluye-premium', '¿Qué incluye Premium?',
$md$Premium agrega el registro con IA (foto, voz y texto), el asistente, planes de comidas, recetas inteligentes, lista de compras, analítica avanzada y exportaciones. El plan gratis mantiene el registro manual, el panel diario, los macros, el agua y el seguimiento básico.

El precio vigente, la moneda y si hay días de prueba se muestran en la página de planes antes de pagar.$md$,
    'faq', 'published', 60),

  ('faq-cancelar-suscripcion', '¿Cómo cancelo mi suscripción?',
$md$Puedes cancelarla cuando quieras desde Ajustes, en la sección de suscripción. Mantienes Premium hasta el final del periodo que ya pagaste y después tu cuenta vuelve al plan gratis sin perder tus registros.$md$,
    'faq', 'published', 70),

  ('faq-quien-ve-mis-datos', '¿Quién puede ver mis datos?',
$md$Tus registros son privados: solo tú los ves. Si decides darle acceso a un profesional (por ejemplo, tu nutricionista), podrá ver tus registros y proponerte metas mientras el acceso esté activo, y puedes quitárselo en cualquier momento.

No vendemos tus datos. Tus fotos de progreso se guardan en un espacio privado al que solo accedes tú.$md$,
    'faq', 'published', 80),

  ('faq-borrar-mis-datos', '¿Puedo descargar o borrar mis datos?',
$md$Sí. Puedes eliminar tu cuenta desde Ajustes, lo que borra tus registros. También puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a nuestro correo de soporte.$md$,
    'faq', 'published', 90),

  ('faq-condiciones-de-salud', '¿Puedo usar la app si tengo una condición de salud?',
$md$Puedes usarla para registrar, pero con cuidado. Si indicas embarazo, lactancia, diabetes con medicación, enfermedad renal o antecedentes de trastornos de la conducta alimentaria, la app limita algunas recomendaciones automáticas y te sugiere trabajar con un profesional de salud.

Si en algún momento registrar lo que comes te genera ansiedad, está bien hacer una pausa y buscar apoyo.$md$,
    'faq', 'published', 100)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Contenido legal: BORRADORES (status 'draft', no visibles al público)
-- ---------------------------------------------------------------------------
insert into public.content_pages (slug, title, body_md, kind, status, sort_order)
values
  ('terminos', 'Términos y condiciones',
$md$> **Borrador: revisar con un abogado antes de publicar.** Este texto es un punto de partida y no constituye asesoría legal. Debe adecuarse a la normativa peruana vigente, incluida la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento, así como a las normas de protección al consumidor.

## 1. Quiénes somos
ORANGE FIT es operado por [RAZÓN SOCIAL], con RUC [RUC] y domicilio en [DIRECCIÓN], Perú (en adelante, "ORANGE FIT"). Contacto: [CORREO DE SOPORTE].

## 2. Qué es el servicio
ORANGE FIT es una herramienta de registro de alimentación, hidratación, peso y hábitos, con cálculos estimados de energía y nutrientes. **No es un servicio médico ni de nutrición clínica** y no reemplaza la evaluación de un profesional de salud.

## 3. Cuenta
- Debes tener al menos [EDAD MÍNIMA] años para crear una cuenta.
- Eres responsable de mantener la confidencialidad de tu contraseña.
- Puedes eliminar tu cuenta en cualquier momento desde Ajustes.

## 4. Plan gratis y Premium
- El plan gratis no tiene costo. Premium es una suscripción de pago con renovación automática según el periodo elegido.
- El precio, la moneda y los días de prueba (si los hay) se muestran antes de pagar.
- Puedes cancelar en cualquier momento; mantienes Premium hasta el fin del periodo pagado.
- [POLÍTICA DE REEMBOLSOS]

## 5. Uso de inteligencia artificial
Las funciones con IA generan estimaciones que pueden contener errores. Nada se registra sin tu confirmación. Los usos de IA de Premium tienen límites mensuales que se muestran en la app.

## 6. Conducta del usuario
No debes usar el servicio para fines ilícitos, intentar acceder a datos de otras personas ni afectar su funcionamiento.

## 7. Limitación de responsabilidad
[REDACTAR CON ASESORÍA LEGAL]

## 8. Cambios a estos términos
Te avisaremos de cambios relevantes con anticipación razonable.

## 9. Ley aplicable
Estos términos se rigen por las leyes de la República del Perú. [JURISDICCIÓN / LIBRO DE RECLAMACIONES]$md$,
    'legal', 'draft', 10),

  ('privacidad', 'Política de privacidad',
$md$> **Borrador: revisar con un abogado antes de publicar.** Este texto debe adecuarse a la Ley N.° 29733, Ley de Protección de Datos Personales del Perú, y su reglamento vigente, incluida la inscripción del banco de datos personales ante la Autoridad Nacional de Protección de Datos Personales cuando corresponda.

## 1. Responsable del tratamiento
[RAZÓN SOCIAL], RUC [RUC], domicilio [DIRECCIÓN]. Contacto para privacidad: [CORREO].

## 2. Qué datos tratamos
- **Cuenta:** correo electrónico, nombre visible.
- **Perfil:** fecha de nacimiento, sexo para cálculos, estatura, zona horaria, país.
- **Registros:** comidas, agua, peso, medidas, ayunos, ejercicio, fotos de progreso (opcionales).
- **Datos de salud** (datos sensibles): ver la política específica de datos de salud.
- **Pagos:** identificadores de la pasarela y montos. **No guardamos datos de tarjetas.**
- **Técnicos:** registros de errores sin contenido de salud.

## 3. Para qué los usamos
Para darte el servicio (cálculos, panel, historial), procesar pagos, dar soporte y mejorar la app con métricas agregadas que no te identifican.

## 4. Base del tratamiento
Tu consentimiento, que puedes revocar, y la ejecución del servicio que contrataste. [VALIDAR CON ASESORÍA LEGAL]

## 5. Con quién los compartimos
Proveedores que nos ayudan a operar (alojamiento y base de datos, pasarelas de pago, proveedores de IA para analizar lo que tú envías). [LISTA DE ENCARGADOS Y PAÍSES — evaluar flujo transfronterizo]. No vendemos tus datos.

## 6. Cuánto tiempo los guardamos
Mientras tengas cuenta. Al eliminarla borramos tus registros, salvo lo que debamos conservar por obligación legal. [PLAZOS]

## 7. Tus derechos
Puedes ejercer tus derechos de acceso, rectificación, cancelación y oposición escribiendo a [CORREO]. Si no quedas conforme, puedes acudir a la Autoridad Nacional de Protección de Datos Personales.

## 8. Seguridad
Aplicamos controles de acceso por usuario, cifrado en tránsito y almacenamiento privado para fotos.$md$,
    'legal', 'draft', 20),

  ('datos-de-salud', 'Tratamiento de datos de salud',
$md$> **Borrador: revisar con un abogado antes de publicar.** La Ley N.° 29733, Ley de Protección de Datos Personales del Perú, considera los datos de salud como datos sensibles. Este texto y el flujo de consentimiento deben validarse con asesoría legal antes de usarse.

## Qué datos de salud tratamos
Peso, medidas corporales, porcentaje de grasa (si lo registras), lo que comes, condiciones que tú indiques (por ejemplo, embarazo, lactancia, diabetes con medicación, enfermedad renal o antecedentes de trastornos de la conducta alimentaria) y fotos de progreso si decides subirlas.

## Para qué
Solo para calcular tus metas, mostrarte tu progreso y activar avisos o límites de seguridad en las recomendaciones automáticas.

## Tu consentimiento
Te pedimos un consentimiento específico, separado de los términos, antes de guardar datos de salud. Puedes revocarlo en cualquier momento desde Ajustes; algunas funciones dejarán de estar disponibles.

## Quién accede
Solo tú. Un profesional de salud accede únicamente si tú le das acceso, y puedes revocarlo cuando quieras.

## Inteligencia artificial
Cuando usas funciones con IA, enviamos al proveedor solo lo necesario para el análisis (la foto, el audio o el texto que tú envías). [DETALLAR PROVEEDOR, PAÍS Y CONDICIONES DE NO ENTRENAMIENTO]

## Contacto
[CORREO DE PRIVACIDAD]$md$,
    'legal', 'draft', 30)
on conflict (slug) do nothing;
