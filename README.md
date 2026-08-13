# Mamamía

Control de finanzas personales en **un solo archivo HTML**. Ingresos, gastos, deudas,
suscripciones y ahorro, con gráficos y consejos automáticos sobre tus propios números.

Sin instalación, sin servidor, sin cuenta. Moneda: soles peruanos (S/).

## Cómo usarlo

Descarga `index.html` y ábrelo con doble clic. Ya está.

La primera vez verás la app vacía. Ve a **Ajustes → Cargar datos de ejemplo** para ver
cómo funciona todo con datos de mentira, y luego **Borrar todo** cuando quieras empezar
con los tuyos.

También puedes publicarlo en la web: sube `index.html` a un repositorio de GitHub y activa
**Settings → Pages → Deploy from a branch**. Tendrás la app en tu propia URL, accesible
desde el móvil.

## Qué hace

- **Panel** — ingresos, gastos, flujo neto, tasa de ahorro y patrimonio neto del mes, con
  la comparativa contra el mes anterior, los avisos más urgentes y los cobros que vienen en
  los próximos 30 días.
- **Movimientos** — registro de ingresos y gastos con categorías propias, filtros y
  buscador, y el desglose de en qué se te fue el dinero.
- **Presupuestos** — un tope mensual por categoría con aviso al 80% y alerta al pasarte,
  más el reparto 50/30/20 comparado con lo recomendado.
- **Deudas** — cada deuda con su TEA, cuota, interés del primer mes, meses restantes y
  fecha estimada de liquidación. Incluye un simulador que compara **bola de nieve** contra
  **avalancha** con el pago extra que le quieras meter, y te dice cuánto ahorras en
  intereses con cada una.
- **Suscripciones** — coste normalizado a mensual y anual, próximos cobros, y detección de
  las que pagas pero no usas.
- **Ahorro** — cuentas, fondo de emergencia en meses de gastos cubiertos, y metas con
  fecha estimada calculada sobre tu **ritmo real** de aportes, no sobre el que planeaste.
- **Consejos** — 13 reglas que miran tus datos y te dicen qué está mal y qué hacer.
  Si no hay datos suficientes, lo dice en vez de inventarse alarmas.

## Dónde están tus datos

En el almacenamiento local de **ese navegador y ese dispositivo**, nada más. No hay
servidor, no hay cuenta, no se envía nada a ninguna parte.

La contrapartida es que si borras los datos del navegador, usas el modo incógnito o cambias
de dispositivo, los datos no te siguen. Usa **Ajustes → Exportar copia** de vez en cuando:
descarga un `.json` que puedes volver a cargar desde **Restaurar desde archivo**. Ese
archivo es también la forma de pasar tus datos del móvil al ordenador.

## Consejos por IA (opcional, desactivado por defecto)

Si pegas tu propia clave de API de Anthropic en Ajustes, aparece un botón para pedir un
análisis escrito de tu mes.

Antes de activarlo, ten claro que:

- La clave se guarda **sin cifrar** en el almacenamiento local de ese navegador.
- Al pedir un análisis se envía a los servidores de Anthropic un **resumen agregado** de
  tus finanzas: totales por categoría, ratios, deudas, suscripciones y metas. **No** se
  envía la lista de movimientos, ni notas, ni nombres de cuentas.
- Usa una clave con límite de gasto, y no actives esto en un ordenador compartido.

Todo lo demás de la app funciona sin clave y sin conexión.

## Aviso

Mamamía es una herramienta de organización personal, no asesoría financiera profesional.
Los cálculos de amortización asumen cuotas y tasas constantes y no incluyen comisiones,
seguros ni portes, así que las fechas y los intereses son estimaciones, no cifras
contractuales.

## Para desarrollar

Todo está en `index.html`: HTML, CSS, JavaScript y los gráficos SVG, sin dependencias ni
paso de compilación. El código está dividido en secciones numeradas y comentadas:

| Sección | Contenido |
|---|---|
| §1 | Estado, persistencia en `localStorage`, exportar e importar |
| §2 | Utilidades: formato de moneda y fechas, recurrencias |
| §3 | Motor de cálculo: agregados mensuales, amortización, proyecciones |
| §4 | Motor de consejos: las 13 reglas |
| §5 | Gráficos SVG escritos a mano |
| §6 | Formularios y diálogo |
| §7 | Las ocho vistas |
| §8 | Integración opcional con la API de Claude |
| §9 | Datos de ejemplo |
| §10 | Render y eventos |

Los cálculos de amortización están contrastados contra una tabla de amortización calculada
aparte, y cada regla de consejos tiene un escenario que la dispara.
