# ORANGE FIT — Plan de cierre y cacería de fallos

Qué se hace después de terminar los 10 módulos, en qué orden, cómo se decide qué es un fallo y
con qué prompt trabajan los agentes. El registro de cada ronda va en `docs/QA_LOG.md`.

## Condiciones del entorno

| Hecho | Consecuencia |
|---|---|
| 4 CPU → solo 2 agentes a la vez | Rondas de 6 buscadores como máximo; verificación con 2 agentes por hallazgo, más un tercero solo si empatan |
| La cuenta tiene un límite de uso que corta cada pocas horas | Cada ronda es un workflow aparte; si se corta, se reanuda con `resumeFromRunId` sin repetir lo hecho |
| Al reiniciarse el contenedor se cae Docker | Antes de cada ronda: `dockerd` arriba y Supabase local respondiendo (REST y Auth en 200) |
| No hay claves de Anthropic, Stripe, Mercado Pago, USDA, VAPID ni Google | Esas integraciones se prueban con SDK simulado o firmas locales; nunca se informa un éxito real que no ocurrió |

## Fase A — Integración (puerta de entrada)

1. Revisar las migraciones nuevas de los módulos (`2026101310xxxx_*`, `20261013110001`) y que no se pisen.
2. Reiniciar Supabase para aplicar `config.toml` (contraseña de 8, plantillas con `token_hash`) y correr `supabase db reset`.
3. Regenerar `src/lib/db/database.types.ts` y quitar los tipos locales provisorios que dejaron los módulos.
4. Aplicar los cambios pedidos en archivos compartidos:
   - montar el registro del service worker en el layout raíz;
   - otorgar logros justo después de `addItemsToMeal`;
   - `OPENAI_TRANSCRIPTION_MODEL` en `serverEnv()`;
   - decidir qué pasa con `getFoodByBarcode`;
   - un enlace fijo a `/app/notificaciones`;
   - el cron de recordatorios (`vercel.json`);
   - iconos (`/favicon.ico`, `/icons/logo.svg`, `/icons/apple-touch-icon.png`) en la metadata del layout raíz;
   - el menú de admin según el rol, para que un editor no vea secciones que le dan 404;
   - `reportClientError(error)` en los `error.tsx` de cada módulo;
   - quitar de `docs/DESIGN_SYSTEM.md` §11 el pendiente de manifest e iconos;
   - avisar que `app_settings.support_email` (`soporte@example.com`) se cambia antes de producción.
5. `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`: todo en verde.
6. Recorrido de todas las rutas con `next start` y Playwright a 390 px: sin respuestas 500, sin errores de consola, sin desborde horizontal.
7. Commit «integración» y push.

**Criterio:** los cinco comandos en verde y el recorrido sin fallos. Sin esto no empieza nada más.

## Fase B — Entregables pendientes

1. E2E con Playwright contra Supabase local y Mailpit:
   - registro → verificación por correo → onboarding → panel;
   - registrar en el diario;
   - ayuno bloqueado para perfil de riesgo;
   - `/admin` 404 sin rol;
   - IA 503 sin clave;
   - checkout 503 sin claves.
2. Capturas reales en `public/screenshots/` para la landing (390 px, tema claro y oscuro).
3. Documentación:
   - `README.md` y `.env.example`;
   - `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md` y `docs/SECURITY.md`;
   - `FEATURES.md`, con tres listas: funcional, requiere credenciales y pendiente.
4. Commit, push y descripción del PR #1 actualizada.

## Fase C — Bucle de cacería de fallos (hasta agotar tokens)

### Una ronda

```
Buscar (≤6 lentes en paralelo, de a 2)
  → Deduplicar contra todo lo ya visto (código, no agente)
  → Verificar cada hallazgo nuevo: 2 agentes intentan REFUTARLO; si empatan, decide un tercero
  → Corregir lo confirmado: un agente por grupo de archivos disjuntos, con test de regresión
  → Puerta: lint + typecheck + unit + integración + build
  → Commit «QA ronda N» + push + entrada en docs/QA_LOG.md
```

- **Deduplicación:** dos hallazgos son el mismo si coinciden archivo, lente y causa, con las líneas a menos de 15 de distancia. Se compara contra *todo lo visto*, no solo contra lo confirmado. Así lo refutado no vuelve en cada ronda.
- **Sobrevive** el hallazgo que confirman 2 de 2 verificadores, o 2 de 3 si hubo desempate. Ante la duda, se da por refutado.
- **Se corrige** lo de severidad crítica, alta o media. Lo de severidad baja se anota en `QA_LOG.md` y no se toca.
- **Puerta roja:** si falla, se corrige en la misma ronda. Si no se puede, se revierte el cambio que la rompió y el hallazgo queda abierto con su motivo.

### Lentes

Cada ronda elige 6, empezando por las de mayor riesgo. Una lente que da dos rondas seguidas sin
hallazgos nuevos confirmados se retira y entra la siguiente.

| # | Lente | Qué busca |
|---|---|---|
| 1 | Autorización y RLS | Rutas, server actions o queries sin `requireUser`/`requireRole`; `user_id` tomado del cliente; IDOR; políticas RLS o de Storage que dejan leer o escribir lo ajeno; uso del service role sin autorizar antes |
| 2 | Secretos y datos sensibles | Claves o service role alcanzables desde el cliente; `server-only` faltante; datos de salud o PII en logs, errores, URLs o respuestas; export que incluye datos ajenos |
| 3 | Pagos y webhooks | Firma que no se verifica o se compara mal; idempotencia; eventos fuera de orden; estados mal mapeados; doble cobro; acceso que no se quita; montos, moneda PEN o centavos mal |
| 4 | IA | Comida registrada sin confirmar; nutrientes inventados por el modelo; cupo que no se descuenta o se descuenta dos veces; consentimiento sin revisar; inyección de prompt desde el texto o la foto; costo mal calculado; respuestas falsas sin clave |
| 5 | Corrección nutricional | Mifflin-St Jeor, factores de actividad, pisos (1200/1500, nunca bajo el metabolismo basal), conversiones de unidades y porciones, escalado de recetas, totales del día, planificador fuera de ±10 %, MET con kcal netas, redondeos acumulados |
| 6 | Honestidad del producto | Algo simulado presentado como real; botones que no hacen nada; integraciones sin clave que no dicen «pendiente de configurar»; promesas de resultados; textos que contradicen lo que hace el código |
| 7 | Salud y seguridad del usuario | Déficit o ayuno ofrecidos a menores, embarazo, lactancia, antecedentes de TCA, medicación para diabetes o enfermedad renal; mensajes que castigan; números de peso mostrados a quien no debe verlos |
| 8 | Fechas, zona horaria e integridad | `local_date` calculado en UTC en vez de America/Lima; cambios de día; carreras al registrar dos veces; upserts que pisan; borrados en cascada que dejan archivos huérfanos; migraciones que no se aplican limpias |
| 9 | Next.js 16 y React 19 | `params`/`searchParams`/`cookies` sin `await`; código de servidor en el cliente; `revalidatePath` faltante (datos viejos tras guardar); redirecciones en bucle; errores de hidratación; `proxy.ts` que deja pasar rutas privadas |
| 10 | UX móvil y accesibilidad | Desborde a 390 px; objetivos táctiles menores de 44 px; inputs a menos de 16 px (zoom en iOS); campos sin label; contraste bajo (texto blanco sobre naranja); listas sin estado vacío, de carga o de error; foco perdido en diálogos |
| 11 | Ley 29733 y cuenta | Consentimientos sin versión o sin registro de retiro; eliminación de cuenta que deja datos o archivos; export incompleto; textos legales que prometen algo que el código no hace |
| 12 | Rendimiento y abuso | Consultas N+1 en páginas frecuentes; búsquedas sin límite; rutas públicas sin rate limit (errores, códigos de barras, IA); archivos subidos sin tope de tamaño o tipo |

### Severidad

| Nivel | Significa |
|---|---|
| Crítica | Fuga o modificación de datos ajenos, cobro indebido, secreto expuesto, riesgo de salud por un consejo peligroso |
| Alta | Una función principal rota para un caso común, o un dato nutricional o de pago incorrecto que el usuario no puede detectar |
| Media | Falla en un caso borde realista, un estado de error que miente, accesibilidad que bloquea una tarea |
| Baja | Cosmético, un caso muy improbable, o una mejora sin fallo concreto |

### Cuándo se detiene

- Dos rondas seguidas sin hallazgos nuevos confirmados de severidad media o más.
- Los tokens restantes no alcanzan para una ronda completa.
- Tú lo pides.

Si el límite de uso corta una ronda, se reanuda la misma ronda; no se empieza otra.

---

## Prompt maestro

Todos los agentes del bucle reciben este bloque. Debajo están las partes específicas de cada rol.

```
Eres parte de un equipo de QA senior que audita ORANGE FIT, un SaaS de nutrición para Perú.
Código en /home/user/Mamamia/orange-fit. Stack: Next.js 16.4 (App Router, proxy.ts; params,
searchParams y cookies son async; cacheComponents desactivado), React 19, TypeScript estricto,
Tailwind v4, Supabase (Postgres con RLS en todas las tablas, Auth, Storage), Zod, TanStack Query.
Supabase local: API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres,
correo en Mailpit http://127.0.0.1:54324, claves en .env.local.

Antes de opinar sobre un módulo lee docs/CONVENTIONS.md, docs/DATA_MODEL.md y el informe del
módulo en docs/modules/<módulo>.md.

Reglas del producto que NUNCA pueden romperse:
1. Nada simulado se presenta como real. Sin credencial, la API responde con error real (503) y la
   UI dice «pendiente de configurar». Nunca se inventa una respuesta exitosa de un servicio externo.
2. Los nutrientes salen de la base (tabla foods o recetas calculadas) y guardan su procedencia. La IA
   solo propone qué alimento y cuánto. Las estimaciones se marcan como tales.
3. Nada que venga de IA se registra sin confirmación del usuario.
4. Cada usuario solo accede a sus propios registros. Las fotos corporales son privadas (URL firmadas).
5. Secretos y service role solo en servidor. No se almacenan datos de tarjetas.
6. Sin promesas de resultados, sin dietas extremas, sin castigar por comer. Se respetan los pisos de
   calorías y los bloqueos por perfil de riesgo (src/lib/nutrition/risk.ts).
7. Datos personales tratados según la Ley 29733 de Perú: consentimiento versionado, retiro,
   eliminación y exportación.

Un FALLO es una conducta concreta e incorrecta del código actual que puedes mostrar con un camino
real: quién hace qué, con qué datos, qué pasa y qué debería pasar. NO son fallos: preferencias de
estilo, refactors sin defecto, «podría ser más robusto» sin un caso que falle, ni funciones que el
encargo no pide.

Estándar de evidencia: cita archivo y líneas del código que falla. Siempre que se pueda, reprodúcelo:
un test temporal en /tmp/qa/<tu-etiqueta>/ (vitest o un script contra Supabase local) y la salida real
del comando. Si no lo reprodujiste, dilo y baja tu confianza. Nunca afirmes que corriste algo que
no corriste.

No ejecutes next dev, next build ni supabase db reset; no cambies config.toml ni migraciones
existentes. Los usuarios de prueba que crees en Supabase local se llaman qa-<etiqueta>-* y los
borras al terminar.
```

### Rol: buscador (una lente por agente)

```
Tu lente es: <LENTE> — <QUÉ BUSCA>.
Alcance: <ARCHIVOS O MÓDULOS>. Ya vistos en rondas anteriores (no los repitas): <LISTA RESUMIDA>.
No edites archivos del proyecto. Busca a fondo: lee el código, sigue los datos desde la entrada del
usuario hasta la base y de vuelta, y prueba los casos borde. Devuelve SOLO hallazgos que cumplan el
estándar de evidencia, con: lente, severidad (crítica|alta|media|baja), título, archivo, líneas,
escenario (pasos concretos), impacto, evidencia (cita y salida de lo que ejecutaste), propuesta de
corrección mínima y confianza (0–1). Lista vacía si no encontraste nada real: es una respuesta válida.
```

### Rol: verificador (intenta refutar)

```
Te pasan UN hallazgo. Tu trabajo es intentar REFUTARLO. Lee el código actual (puede haber cambiado),
busca la guarda que lo impida (RLS, validación Zod, requireUser, checks en SQL, otra capa) y trata de
reproducirlo con un test temporal en /tmp/qa/verify-<id>/. Veredicto: confirmado (lo reprodujiste o
el camino es inequívoco), refutado (muestra la guarda o la ejecución que lo descarta) o dudoso.
Si dudas, refutado. Si lo confirmas pero la severidad no corresponde, corrígela con su motivo.
No edites archivos del proyecto.
```

### Rol: corrector (un grupo de archivos disjunto)

```
Te pasan hallazgos CONFIRMADOS que tocan solo estos archivos: <LISTA>. Para cada uno:
1) escribe primero un test de regresión que falle con el código actual (unit o integración, en la
   carpeta de tests del módulo) y comprueba que falla;
2) aplica la corrección MÍNIMA que lo arregla, respetando docs/CONVENTIONS.md;
3) comprueba que el test pasa y corre los tests del módulo, tsc y eslint de tus archivos.
No toques archivos fuera de tu lista. Si la corrección exige cambiar un archivo compartido o de
otro módulo, NO lo hagas: descríbelo en tu informe. Sin dependencias nuevas. Sin commits.
Informe: por hallazgo, corregido o no (con motivo), archivos tocados, test agregado y salida real de
las verificaciones.
```

### Lo que hago yo (integrador) en cada ronda

- Reparto el alcance de los buscadores y la lista de lo ya visto.
- Agrupo lo confirmado por archivos para que dos correctores nunca toquen el mismo archivo.
- Hago los cambios en archivos compartidos que pidan los correctores.
- Corro la puerta completa, hago commit y push y actualizo `docs/QA_LOG.md` con lo encontrado, refutado, corregido y abierto.
