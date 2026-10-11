# MiCoach

Dieta, entrenamiento, suplementos y progreso en **un solo archivo HTML**, pensado para el
celular y para usarse con una mano. Tema oscuro, botones grandes, sin cuenta y sin servidor.

## Cómo usarlo

Abre `index.html` en el navegador del celular. La primera vez te pide sexo, edad, altura,
peso y metas de peso, y con eso calcula tus metas diarias. Esos datos se quedan en ese
navegador: el código no trae ningún perfil.

Para tenerlo como app: publícalo con GitHub Pages (queda en `…/micoach/`), ábrelo en el
celular y usa **Agregar a pantalla de inicio**.

## Qué hace

- **Hoy** — kcal que te quedan, barras de proteína, carbos y grasa, las 5 comidas del plan con
  "Lo comí", "Cambiar" (con intercambios) o "No comí", extras fuera del plan, agua, reto de 2
  porciones de verdura, suplementos, entreno y cardio del día, pasos, sueño, peso y nota.
- **Dieta** — plan semanal editable, ~100 alimentos y platos peruanos con macros, intercambios
  equivalentes por grupo, y lista de compras de la semana en crudo, con precios editables y tope
  de S/200.
- **Entreno** — rutina por día, peso y reps por serie, la sesión anterior al lado, sugerencia de
  subir carga cuando completas el tope del rango en todas las series, y temporizador de descanso
  que vibra y suena. Los ejercicios de pecho y hombro tienen **Me dolió**: propone un sustituto,
  lo cambia solo hoy o en la rutina, y lo anota en el resumen.
- **Progreso** — peso diario con promedio móvil de 7 días, cintura, adherencia de las últimas
  semanas, rachas, y fecha proyectada para cada meta con tu ritmo real.
- **Perfil** — datos, metas, horarios, historial de ajustes y **Copiar resumen semanal** para
  pegárselo a tu coach.

## Cómo calcula

- Calorías: Mifflin-St Jeor × 1.45 − 800, redondeado hacia abajo a 50. **Piso fijo de 1800 kcal**:
  ninguna meta ni sugerencia baja de ahí.
- Proteína: 1.65 g por kg al empezar, luego fija. Grasa ≈ 26.5 % de las kcal. Carbos, el resto.
- Ajuste con el promedio de 7 días (mínimo 3 pesajes por ventana):
  - si no baja en 2 semanas (o casi nada en 3), sugiere −150 kcal; si ya estás en el piso,
    sugiere más pasos y cardio en vez de menos comida;
  - si baja más de 1.2 kg/semana dos semanas seguidas, sugiere +150 kcal. Las 2 primeras semanas
    no cuentan para esta regla: esa bajada es agua y glucógeno;
  - cada 3 kg perdidos propone recalcular las metas con el peso nuevo.
  - Tras aplicar o descartar una sugerencia de kcal, espera 14 días antes de proponer otra.
- Zinc: máximo 3 tomas en cualquier ventana de 7 días; la casilla se bloquea y dice cuándo vuelve.
- Bloqueados siempre: press tras nuca, fondos y remo al mentón. El editor de rutina no los acepta.

## Dónde están tus datos

En el almacenamiento local de **ese navegador y ese celular**. Si borras los datos del navegador
o cambias de equipo, se pierden: usa **Perfil → Exportar copia** de vez en cuando y
**Restaurar copia** para recuperarlos. Las copias (`micoach-*.json`) están en `.gitignore`.

Los gráficos usan Chart.js desde un CDN. Sin conexión, la app funciona igual y los gráficos
muestran un aviso.

## Aviso

MiCoach es una herramienta de orientación. No reemplaza a un médico ni a un nutricionista.
Los valores nutricionales y los precios son aproximados.
