# Módulo pagos — planes, precios, suscripciones y cobros

Dueño de: `src/lib/billing/*` (salvo `features.ts` y `entitlements.ts`, compartidos), `src/features/billing/*`,
`src/app/api/billing/*`, `src/app/precios`, `src/app/app/premium` (+ `gracias`), `src/app/app/perfil/suscripcion`,
pruebas `src/lib/billing/*.test.ts`, `src/features/billing/**/*.test.ts(x)`, `tests/integration/pagos*.test.ts`.

Regla de oro: **el acceso Premium solo lo da la BD** (`is_premium()` = suscripción `trialing`/`active` con fin de prueba o
de periodo en el futuro). `subscriptions`, `payments` y `billing_events` se escriben **solo con service role**, desde los
webhooks o desde una acción ya autenticada (cancelar / confirmar). Nunca se guardan datos de tarjeta.

## Qué quedó funcional

### Librería (`src/lib/billing`)
| Archivo | Qué hace |
|---|---|
| `provider.ts` | Interfaz `BillingProvider { id, label, isConfigured(), createCheckout(input), createPortalOrManageUrl?(…), cancelSubscription(sub), handleWebhook(request) }` y `getBillingProvider(id)`. Los métodos lanzan `BillingError(status, code, message)`. |
| `stripe.ts` | SDK `stripe` 23 **sin fijar `apiVersion`** (usa la que trae el SDK, `2026-09-30.endive`). Checkout Session `mode: "subscription"` con `price = stripe_price_id`, `subscription_data.trial_period_days`, `client_reference_id` + `metadata.user_id/price_id/plan_id` (también en la suscripción), `customer_email` (o el `customer` de una suscripción anterior), `locale es-419`. Billing Portal. Cancelar = `cancel_at_period_end: true` (o cancelación inmediata si está `past_due`, para que Stripe deje de reintentar). Webhook: `Stripe.webhooks.constructEvent(await request.text(), stripe-signature, STRIPE_WEBHOOK_SECRET)` → 400 si falla; idempotencia en `billing_events`; eventos `checkout.session.completed`, `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid`, `invoice.payment_failed`. |
| `mercadopago.ts` | REST con `fetch` (sin SDK). `POST /preapproval` (`reason`, `external_reference = user_id`, `payer_email`, `back_url`, `status: "pending"`, `auto_recurring { frequency 1 \| 12, frequency_type "months", transaction_amount, currency_id "PEN", free_trial { frequency: días, frequency_type: "days" } }`) → `init_point`. Cancelar con `PUT /preapproval/{id} { status: "cancelled" }`. Webhook: `x-signature` (`ts`, `v1`) = HMAC-SHA256 de `id:{data.id};request-id:{x-request-id};ts:{ts};` con `MERCADOPAGO_WEBHOOK_SECRET`, comparación con `timingSafeEqual`, ventana de 24 h; luego **siempre** consulta el recurso real (`GET /preapproval/{id}` o `GET /authorized_payments/{id}`) con `MERCADOPAGO_ACCESS_TOKEN`. |
| `status.ts` | Mapeo de estados Stripe/Mercado Pago → `subscription_status` (lo desconocido nunca da acceso), estado de cobros, `describeSubscription` (mismo criterio que `is_premium`), `pickCurrentSubscription`, `blocksNewCheckout`, `isTrialEligible`. |
| `pricing.ts` | `annualSavings` (ahorro anual, % redondeado hacia abajo), `trialDaysFor` (días del precio o `default_trial_days`), qué precio sirve para cada proveedor, conversión céntimos ↔ montos de Mercado Pago. |
| `sync.ts` | Escrituras con service role: `claimBillingEvent` (insert en `billing_events`; `23505` → duplicado, 200 sin reprocesar), `releaseBillingEvent` (si el proceso falla, para que el reintento del proveedor funcione), `upsertSubscription` (por `provider_subscription_id`; nunca cambia de dueño y nunca revive una cancelada/vencida con un evento viejo), `recordPayment` (un cobro no "retrocede": un fallo tardío no pisa un pago exitoso), `notifyPaymentFailed` (aviso en la app con `createNotification`). |
| `catalog.ts` | `getBillingCatalog` (planes y precios activos, RLS pública) y `getProvidersAvailability()` = credenciales **y** bandera del admin (`feature_flags.payments_stripe` / `payments_mercadopago`; solo un `false` explícito apaga). |
| `http.ts`, `types.ts` | Respuestas `{ error: { code, message } }` con `Cache-Control: private, no-store`; tipos y `BillingError`. |

Mercado Pago no tiene "cancelar al final del periodo": al cancelar se detienen los cobros de inmediato, pero si la
persona tenía acceso pagado (o prueba) vigente, se conserva el estado con `cancel_at_period_end = true` hasta esa fecha.

### Rutas (`src/app/api/billing`)
Todas responden JSON; las de la persona comprueban origen (403) y sesión (401) y nunca confían en ids del cliente.
| Ruta | Contrato |
|---|---|
| `POST /api/billing/checkout` | Body `{ priceId: uuid, provider: "stripe" \| "mercadopago" }` → `200 { url, provider, trialDays }`. Errores: 400 `VALIDATION` / `CURRENCY_NOT_SUPPORTED` (Mercado Pago solo PEN) / `PRICE_NOT_PURCHASABLE`; 404 `PRICE_NOT_FOUND` (inexistente o inactivo); 409 `ALREADY_SUBSCRIBED` (ya tiene acceso o un cobro pendiente); 429 `RATE_LIMITED` (10/h); **503 `BILLING_NOT_CONFIGURED`** sin claves del proveedor, `PROVIDER_DISABLED` si el admin lo apagó, `PRICE_NOT_CONFIGURED` si el precio no tiene `stripe_price_id`; 502 `PROVIDER_ERROR`. La prueba gratis solo se ofrece en la primera suscripción. |
| `POST /api/billing/portal` | `200 { url }`: Billing Portal de Stripe o el panel de suscripciones de Mercado Pago. 404 `NO_SUBSCRIPTION`, 503 sin claves. |
| `POST /api/billing/cancel` | Cancela la renovación de la suscripción vigente, guarda el estado devuelto por el proveedor (service role) y crea un aviso. `200 { subscription, provider }`; 404 `NO_ACTIVE_SUBSCRIPTION`; 409 `ALREADY_CANCELED`; 503 sin claves (o sin service role); 502 si el proveedor falla. |
| `POST /api/billing/confirm` | Body `{ sessionId?: "cs_…", preapprovalId? }` → `200 { state: "confirmed" \| "payment_issue" \| "pending", label }`. Lee el estado real; si aún no hay acceso y llegó la referencia del proveedor, la consulta (solo si es de esta persona: `client_reference_id` / `external_reference`) y sincroniza. Límite de 40 consultas al proveedor cada 10 min. |
| `POST /api/billing/webhooks/stripe` | Sin sesión, solo firma. 400 firma inválida o ausente; 503 sin `STRIPE_WEBHOOK_SECRET`; 200 `{ received, result }` o `{ duplicate: true }`; 500 si falla el proceso (el evento se libera y Stripe reintenta). Con `STRIPE_SECRET_KEY` vuelve a leer la suscripción actual (Stripe no garantiza el orden); sin ella usa el contenido firmado. |
| `POST /api/billing/webhooks/mercadopago` | Sin sesión, solo firma. 400 firma inválida, vieja, o `data.id` del cuerpo distinto al firmado; 503 sin secreto o sin token; idempotencia por id de notificación; 500 → Mercado Pago reintenta. |

### Páginas
- **`/precios`** (pública, `SiteHeader`/`SiteFooter`): Gratis vs Premium desde `plans`/`plan_prices`, selector mensual/anual
  con ahorro calculado (`S/ 29.90` vs `S/ 199.90` → "ahorra 44 %", equivalente mensual y monto ahorrado), precio en
  dólares con tarjeta internacional, prueba gratis si aplica, tabla comparativa (FEATURE_LABELS + funciones base + cupos de
  IA), formas de pago con su disponibilidad real y FAQ (cancelación, no guardamos tarjetas, moneda, prueba, sin promesas de
  resultados). Si la BD falla: aviso de error, nunca precios inventados. Sin proveedores: "Elegir Premium" deshabilitado
  con el motivo. `loading.tsx` propio.
- **`/app/premium`**: periodo + medio de pago (Mercado Pago en soles / tarjeta internacional vía Stripe en dólares). Cada
  opción muestra su precio o el motivo por el que está deshabilitada ("Pagos pendientes de configurar.", "Precio pendiente de
  configurar en Stripe.", "no disponible por ahora"). Si ya tiene Premium muestra su estado; si tiene un cobro pendiente,
  lo manda a Suscripción. `?cancelado=1` explica que no se cobró nada. `loading.tsx` y `error.tsx` propios.
- **`/app/premium/gracias`**: lee la suscripción REAL. Con acceso: "Listo, ya tienes Premium" con fin de prueba o próximo
  cobro. Sin acceso: "Estamos confirmando tu pago" y consulta `POST /api/billing/confirm` cada 4 s (~2 min); al confirmar
  refresca la página (el "listo" lo pinta el servidor con datos). Si el proveedor reporta un problema, lo dice; si tarda,
  ofrece "Volver a revisar" y el correo de soporte.
- **`/app/perfil/suscripcion`** (hereda `loading`/`error` de `/app/perfil`): plan, estado (con texto, no solo color),
  medio de pago, precio, prueba hasta / próximo cobro / Premium hasta, cancelación programada, cobro fallido, pago
  incompleto. **Cancelar renovación** con diálogo de confirmación que explica hasta cuándo conserva Premium (es el destino
  del aviso 409 de "eliminar cuenta con suscripción activa"). Gestionar el pago: Stripe → Billing Portal; Mercado Pago →
  su panel. Sin claves, los botones quedan deshabilitados con el motivo. Historial de `payments` (fecha en la zona de la
  persona, monto, estado, proveedor) con estado vacío.

## Requiere credenciales o configuración
- `SUPABASE_SERVICE_ROLE_KEY`: webhooks, cancelar y confirmar (sin ella: 503).
- `NEXT_PUBLIC_SITE_URL`: base de las URL de retorno (en producción, **https**; Mercado Pago rechaza `back_url` sin https).
- **Stripe**: `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` (ambas para "configurado").
  1. Crear un producto "Premium" con un Price recurrente por cada fila de `plan_prices` que se quiera cobrar con tarjeta
     (mismo monto, moneda e intervalo) y guardar su id en `plan_prices.stripe_price_id` (desde /admin → Planes y precios).
     Sin `stripe_price_id` el precio aparece como "pendiente de configurar en Stripe".
  2. Endpoint de webhook `https://<dominio>/api/billing/webhooks/stripe` con los eventos `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`,
     `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`.
  3. Activar y configurar el **Customer Portal** (Billing → Customer portal) para que "Gestionar pago en Stripe" funcione
     (si no, la ruta responde 502 con el error real).
  4. En local: `stripe listen --forward-to localhost:3000/api/billing/webhooks/stripe` y usar el `whsec_…` que imprime.
- **Mercado Pago**: `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET`; en "Tus integraciones → Webhooks" la URL
  `https://<dominio>/api/billing/webhooks/mercadopago` con los temas de **Planes y suscripciones**
  (`subscription_preapproval`, `subscription_authorized_payment`) y copiar la clave secreta. Cobra solo en soles (PEN).
  **La semilla trae `feature_flags.payments_mercadopago = false`**: aunque haya claves, la UI lo muestra "no disponible por
  ahora" y el checkout responde 503 `PROVIDER_DISABLED` hasta que el admin lo active.
- `default_trial_days` (app_settings) se usa cuando un precio tiene `trial_days = 0`.

## Qué falta / límites conocidos
- No se pudo probar contra Stripe ni Mercado Pago reales (sin claves y sin red hacia sus APIs): Stripe se probó con eventos
  firmados con `generateTestHeaderString`; Mercado Pago con firma HMAC real y `fetch` simulado. Tampoco se ejecutó
  `next build`/`next dev` (prohibido en el trabajo en paralelo): las páginas se probaron renderizándolas en el servidor
  con datos reales de Supabase local.
- `plan_prices.mercadopago_plan_id` no se usa: la suscripción de Mercado Pago es "sin plan asociado" (monto e intervalo
  van en cada `/preapproval`), así el precio vive solo en `plan_prices`.
- Mercado Pago: el `free_trial` en una preaprobación sin plan depende de la cuenta; si Mercado Pago lo ignora, el primer
  cobro sería inmediato (el estado que guardamos sale siempre de lo que responde su API, no de lo que pedimos).
- Cambiar de plan (mensual ↔ anual) se hace desde el Billing Portal de Stripe; en Mercado Pago hay que cancelar y volver a
  suscribirse cuando termine el periodo.
- Reactivar una suscripción de Stripe cancelada al final del periodo: desde el Billing Portal. En Mercado Pago no se puede
  reactivar una preaprobación cancelada.
- Reembolsos: se registran si llegan por webhook (estado `refunded`), pero no hay flujo de reembolso en la app.
- Sin facturación electrónica (SUNAT) ni comprobantes propios: el comprobante lo emite el proveedor.

## Pruebas
- Unitarias (`npx vitest run src/lib/billing src/features/billing`, 84): mapeo de estados Stripe/Mercado Pago y de cobros,
  `describeSubscription`, selección de la suscripción vigente, elegibilidad de prueba, ahorro anual (semilla: 44 % en soles,
  42 % en dólares), precios por proveedor, firma de Mercado Pago válida / inválida / vieja / mal formada / ts en ms,
  cuerpo de `/preapproval` (anual = 12 meses, `free_trial`, solo PEN), checkout y cancelación con `fetch` simulado,
  webhooks (503 sin secreto, 400 firma inválida o cuerpo alterado), y componentes en jsdom (checkout deshabilitado sin
  proveedores, envío de `priceId`+proveedor, error 409 real, confirmación que refresca solo con dato, cancelar con
  confirmación, tabla de precios con ahorro).
- Integración (`npx vitest run --config vitest.integration.config.ts tests/integration/pagos*.test.ts`, 20):
  webhook de Stripe con firma inválida → 400 sin registrar nada; evento firmado crea la suscripción e `is_premium` pasa a
  `true`; reenviar el mismo evento → 200 `duplicate` sin duplicar; `updated` con cancelación programada; `invoice.paid`
  una sola vez y `invoice.payment_failed` con aviso; factura de 0 ignorada; `deleted` quita Premium y un `updated` viejo no
  la revive; checkout 401/400/403 y **503 sin claves** (Stripe y Mercado Pago); cancelar/portal 404 sin suscripción y 503
  sin claves (sin tocar la fila); confirm; webhook de Mercado Pago con firma real y API simulada (crea la suscripción con
  el precio en soles, idempotente, registra el cobro, ignora `external_reference` ajeno). Render de servidor de
  `/precios`, `/app/premium`, `/app/premium/gracias` (confirmando vs listo) y `/app/perfil/suscripcion` con datos reales.
