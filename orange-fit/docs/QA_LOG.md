# ORANGE FIT — Registro de QA

Lo que encontró cada ronda, qué se corrigió y qué quedó abierto. Método y criterios en
`docs/QA_PLAN.md`.

## Integración (Fase A)

Fallos encontrados al juntar los módulos y recorrer la app compilada a 390 px:

| Severidad | Fallo | Corrección | Prueba que lo cubre |
|---|---|---|---|
| Alta | `/app/perfil` fallaba siempre en producción: la página de servidor llamaba `initials()` de un módulo `"use client"` y se mostraba la pantalla de error | `initials` pasa a `src/lib/initials.ts` | `tests/unit/server-client-boundary.test.ts` (revisa todo `src`), `src/lib/initials.test.ts`, recorrido de humo |
| Media | `/app/perfil` desbordaba 120 px con un correo largo (la pista del grid crecía al ancho del texto) | `grid-cols-1` en el contenedor | recorrido de humo |
| Baja | Cinco tablas solo para lectores de pantalla (`sr-only` en `<table>`) ensanchaban la página 3 px | `sr-only` en un `div` que envuelve la tabla | recorrido de humo |
| Media | `screenshots.ts` miraba `public/` con `fs` en tiempo de ejecución: el build empaquetaba todo el proyecto en el servidor y en un hosting con CDN la captura se daba por existente aunque faltara | lista estática generada (`screenshots.available.ts`) | build sin advertencias |
| Media | El enlace público de un plan compartido inexistente respondía 200 (por el `loading.tsx` del segmento) | sin `loading.tsx` en `/compartido/plan/[token]` | recorrido de humo |
| Media | Correos de confirmación y de recuperación con PKCE: abiertos en otro navegador fallaban | plantillas con `token_hash` | `tests/integration/auth-signup.test.ts` canjea desde otro cliente |
| Alta | `/admin/ia` fallaba siempre en producción: la página de servidor pasaba `format={(n) => …}` a un gráfico `"use client"` (una función no se puede serializar) | prop `valueFormat="usd"` con los formateadores dentro del componente | segunda regla de `tests/unit/server-client-boundary.test.ts`, recorrido de humo |
| Media | Inicio mostraba «673 kcal restantes» en el anillo y «672» en el desglose (y el diario 673) con un consumo decimal: cada número se redondeaba por separado | se redondea lo consumido una vez, antes de restar | `dashboard-cards.test.tsx` (1750 − 1077.5) |
| Media | En `/app/perfil/privacidad` (consentimientos) y en la lista de accesos profesionales, las fechas se formateaban sin zona horaria: de 19:00 a 24:00 en Lima el servidor (UTC) mostraba el día siguiente, el navegador otro, y React fallaba al hidratar | `formatInstantDate(iso, zona)` con America/Lima por defecto | `src/lib/format.test.ts`, regla `tests/unit/date-format-guard.test.ts` (ningún `toLocaleDateString` sin `timeZone`), recorrido de humo a las 22:50 de Lima |
| Baja | `/admin` desbordaba 73 px a 390 px: grids sin columnas explícitas (página y lista de integraciones) crecían hasta el ancho de filas con texto `truncate` | `grid-cols-1` en esos contenedores | recorrido de humo |

Resultado de la Fase A: lint 0 · typecheck 0 · 1065 unitarias · 200 de integración · build sin advertencias ·
E2E 14/14 (registro con correo real, diario, seguridad, integraciones sin credenciales y recorrido de las
89 rutas a 390 px: 85 pantallas por rol + 4 archivos de SEO/PWA).

Pendientes para el bucle (lente UX): en `/app/progreso`, las etiquetas «Ritmo semanal» y «Peso de tendencia» se
cortan con «…» a 390 px.

## Revisión de la documentación (2026-10-14)

Al escribir `ARCHITECTURE.md`, `SECURITY.md` y `DEPLOYMENT.md` se contrastó cada afirmación con el código.
Salieron estos fallos:

| Severidad | Fallo | Corrección | Prueba que lo cubre |
|---|---|---|---|
| Alta | Al retirar el permiso de datos de salud, los profesionales con acceso vigente seguían leyendo y escribiendo los registros (Ley 29733: dato sensible) | `has_professional_access` exige `has_health_consent` (última decisión = otorgado); al volver a autorizar se reanuda | `professional-access.test.ts` (retira, no ve ni escribe; vuelve a dar, ve) |
| Media | El cron de recordatorios seguía avisando a quien retiró el permiso de salud (acceso en pausa) | el cron solo elige perfiles con `onboarding_completed_at` | `seguimiento.test.ts` (perfil en pausa con avisos y ayuno activo: ninguna notificación) |
| Media | Un superadmin podía crear, cambiar o quitar superadmins por la API (solo lo frenaba el Zod del panel) | las políticas de `user_roles` excluyen `superadmin`; solo por SQL | `profiles-roles-billing.test.ts` |
| Baja | La prueba del cron solo pasaba el 2026-10-13: fecha fija contra el reloj real de la base | usa la fecha real de Lima | `seguimiento.test.ts` |
| Baja | La prueba de páginas del admin fallaba a veces: tomaba «la primera» receta del usuario de una consulta sin orden | elige la rechazada (la que tiene nota) | `admin.test.ts` (3 corridas seguidas) |
| Baja | Docs desactualizados: variables de Google con otro nombre, carpeta `seed-pending` que no existe, `getEntitlements(userId)`, «Ajustes» en textos legales y FAQ (es Perfil → Privacidad/Suscripción), script `db:local` roto, SW e iconos «solo en el sitio público», capturas «inexistentes» | textos y script corregidos | — |

## Rondas del bucle (Fase C)

No se ejecutó: se detuvo a pedido para no gastar más tokens. El plan y el prompt maestro quedan en
`docs/QA_PLAN.md` para correrlo después. Sigue abierto lo de arriba (etiquetas cortadas en `/app/progreso`) y los
riesgos de `docs/SECURITY.md` §13.
