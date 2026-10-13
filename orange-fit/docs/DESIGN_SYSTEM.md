# Sistema de diseño — ORANGE FIT

Fitness premium, minimalista y cálido. Mobile-first, claro y oscuro. Identidad propia: naranja +
carbón, tipografía Geist y un motivo de **anillo de progreso** (logo, anillo calórico, indicadores).
No se toman colores, formas, ilustraciones ni textos de otras apps del rubro (en particular Fitia).

Fuente de verdad de los tokens: `src/app/globals.css`. Primitivas: `src/components/ui/*`.
Shells: `src/components/app`, `src/components/marketing`, `src/components/admin`. Marca:
`src/components/brand/logo.tsx`.

---

## 1. Color

### Paleta de marca (constante en ambos temas)
| Token | Hex | Uso |
|---|---|---|
| `brand-orange` | `#FF6B00` | Naranja principal (rellenos, marca) |
| `brand-amber` | `#FF9F43` | Naranja secundario (texto naranja en oscuro, gráficos, anillo de foco en oscuro) |
| `brand-carbon` | `#17181C` | Negro carbón (fondo oscuro, texto sobre naranja) |
| `brand-graphite` | `#25262C` | Superficie oscura (cards en oscuro) |
| `brand-snow` | `#F7F8FA` | Blanco suave (fondo claro, texto en oscuro) |
| gris secundario | `#A1A1AA` | `muted-foreground` en oscuro |

### Tokens semánticos
Se usan como utilidades de Tailwind: `bg-background`, `text-foreground`, `bg-primary`,
`text-primary-strong`, `border-border`, `border-input`, `ring-ring`, `bg-macro-protein`, etc.
**Nunca hex sueltos en componentes.**

| Token | Claro | Oscuro | Para qué |
|---|---|---|---|
| `background` / `foreground` | `#F7F8FA` / `#17181C` | `#17181C` / `#F7F8FA` | Fondo de página y texto principal |
| `card` / `card-foreground` | `#FFFFFF` / `#17181C` | `#25262C` / `#F7F8FA` | Tarjetas, barras, sheets |
| `popover` | `#FFFFFF` | `#25262C` | Menús, diálogos, toasts |
| `primary` / `primary-foreground` | `#FF6B00` / `#17181C` | `#FF6B00` / `#17181C` | **Rellenos** naranjas y su texto |
| `primary-strong` | `#B34700` | `#FF9F43` | **Texto e iconos** naranjas (enlaces, ítem activo) |
| `secondary` / `-foreground` | `#EDEEF1` / `#17181C` | `#2C2D34` / `#F7F8FA` | Botón secundario, controles neutros |
| `muted` / `muted-foreground` | `#EDEEF1` / `#5F6068` | `#2C2D34` / `#A1A1AA` | Pistas, fondos sutiles, texto secundario |
| `accent` / `-foreground` | `#FFF1E6` / `#17181C` | `#33261C` / `#F7F8FA` | Hover de menús, ítem activo, chips de icono |
| `destructive` / `-foreground` | `#C62828` / `#FFFFFF` | `#F87171` / `#17181C` | Acciones irreversibles y errores reales |
| `success` / `-foreground` | `#15803D` / `#FFFFFF` | `#4ADE80` / `#17181C` | Confirmaciones |
| `warning` / `-foreground` | `#B45309` / `#FFFFFF` | `#FBBF24` / `#17181C` | Avisos (no para "te pasaste") |
| `border` | `#E4E6EA` | `#33343B` | Separadores decorativos |
| `input` | `#8B8D96` | `#7A7C85` | Bordes de controles (inputs, checkbox, switch apagado) |
| `ring` | `#D65A00` | `#FF9F43` | Anillo de foco |
| `chart-1…5` | `#E65C00 #A84300 #B07800 #5F6068 #17181C` | `#FF6B00 #FF9F43 #FFD08A #A1A1AA #F7F8FA` | Series de gráficos |
| `macro-protein` | `#0072B2` | `#56B4E9` | Proteína |
| `macro-carbs` | `#A86B00` | `#E6A23C` | Carbohidratos |
| `macro-fat` | `#A8487F` | `#D98CBA` | Grasas |
| `macro-fiber` | `#00785A` | `#2BB58C` | Fibra |

### Decisiones de contraste (WCAG 2.2 AA)
Ratios medidos con la fórmula de luminancia relativa de WCAG.

1. **Texto sobre naranja → carbón, no blanco.** Blanco sobre `#FF6B00` da **2.86:1**: no pasa AA
   ni siquiera para texto grande (3:1). Carbón `#17181C` sobre `#FF6B00` da **6.21:1** (AA texto
   normal). Por eso `primary-foreground` es carbón en ambos temas. Se mantiene el naranja de marca
   intacto en los rellenos en lugar de oscurecerlo.
2. **Texto naranja → `primary-strong`.** `#FF6B00` como texto sobre `#F7F8FA` da 2.69:1 (falla).
   En claro se usa `#B34700`: 5.18:1 sobre background, 5.50:1 sobre card, 4.74:1 sobre muted, 4.97:1
   sobre accent. En oscuro, `#FF9F43`: 8.69:1 sobre background y 7.39:1 sobre card.
   **`text-primary` no se usa para texto**; solo `bg-primary`, `stroke-primary`, `border-primary`.
3. **Texto secundario.** `#A1A1AA` sobre `#F7F8FA` da 2.41:1 → en claro `muted-foreground` es
   `#5F6068` (5.88:1 sobre background, 5.39:1 sobre muted). En oscuro `#A1A1AA` da 6.92:1 / 5.89:1.
4. **Bordes de controles (1.4.11, 3:1).** `input` `#8B8D96` = 3.31:1 sobre card, 3.11:1 sobre
   background; en oscuro `#7A7C85` = 3.63:1 sobre card. `border` es solo decorativo.
5. **Foco.** `ring` `#D65A00` = 3.95:1 sobre card (claro); `#FF9F43` = 8.69:1 (oscuro).
6. **Estados con color + forma.** Checkbox/radio marcados: relleno naranja + marca carbón (6.21:1).
   Switch encendido: pista naranja + perilla carbón; apagado: pista `input` + perilla card (3.31:1
   claro, 3.63:1 oscuro). El ítem activo de navegación cambia color, peso e indicador.
7. **Gráficos.** Todas las series ≥ 3:1 contra card y background en su tema (claro: mínimo 3.35:1,
   `chart-1` sobre background; oscuro: mínimo 5.28:1, `chart-1` sobre card). Las series contiguas
   se distinguen también por etiqueta o leyenda.
8. **Macros.** Tonos de la paleta Okabe-Ito (diseñada para daltonismo: azul / ámbar / púrpura
   rojizo / verde azulado), ajustados para ≥ 4.40:1 sobre card en claro y ≥ 5.81:1 en oscuro.
   Son colores **de gráfico**: el nombre y el número del macro van en `foreground`/`muted-foreground`,
   y el color siempre acompaña a una etiqueta (nunca es la única señal).
9. **"Te pasaste" sin alarma.** Superar la meta no usa rojo ni `warning`: el anillo calórico se
   completa en naranja y una segunda vuelta fina en `foreground` al 75 % indica el exceso; el texto
   dice "X kcal sobre tu meta". Igual en `MacroBar` ("X g sobre la meta" en `muted-foreground`).

---

## 2. Tipografía
- **Geist Sans** (texto) y **Geist Mono** (código/IDs), del paquete npm `geist` (`next/font/local`
  por debajo; no se usa `next/font/google`). Variables `--font-geist-sans` / `--font-geist-mono`
  → `font-sans` / `font-mono`.
- Escala: títulos de pantalla `text-xl`→`lg:text-2xl` semibold `tracking-tight`; títulos de
  página `text-2xl`→`sm:text-3xl`; cuerpo `text-base`/`text-sm`; metadatos `text-xs`.
- Números (kcal, gramos, kg): cifras tabulares con `tabular-nums` o el atributo `data-numeric`.
  Formato siempre con `src/lib/format.ts` (es-PE: `1,850`, `12.5`).
- Inputs a **16 px** (`text-base`) para que iOS no haga zoom.

## 3. Forma, espacio y profundidad
- Radio base `--radius: 1rem`. Escala: `rounded-sm` 0.5rem · `md` 0.75rem · `lg` 1rem ·
  `xl` 1.25rem (botones, inputs) · `2xl` 1.5rem (cards, tiles) · `3xl` 2rem (diálogos, sheets).
- Sombras suaves y difusas: `shadow-xs` (inputs), `shadow-sm` (cards), `shadow-md`, `shadow-lg`
  (menús, diálogos) y `shadow-float` (botón "+", con brillo naranja). En oscuro la sombra es negra.
- Espaciado de pantalla: `px-4` en móvil (lo pone `AppShell`), `lg:px-8`. Cards `p-4`/`p-5`.

## 4. Movimiento
- `motion/react` para animaciones con estado; keyframes CSS para entradas/salidas de Radix.
- Duraciones 150–250 ms. Curva `--ease-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`).
- Animaciones disponibles (`animate-*`): `fade-in/out`, `pop-in/out` (menús, select, tooltip),
  `dialog-in/out`, `slide-in/out-{right,left,top,bottom}` (sheets).
- **Movimiento reducido**: `Providers` envuelve la app en `<MotionConfig reducedMotion="user">` y
  `globals.css` reduce a ~0 ms toda animación/transición CSS con `prefers-reduced-motion: reduce`.
  `ProgressRing` y `SegmentedControl` además consultan `useReducedMotion()` y no animan.
- `ProgressRing`: el arco se llena en 250 ms; la vuelta de exceso entra 150 ms después.

## 5. Accesibilidad (checklist)
- **Objetivos táctiles ≥ 44 px**: `Button` sm 44 / default 48 / lg 56 / icon 48 / icon-sm 44;
  inputs y select 48; ítems de menú/select 44; pestañas 44. Switch, checkbox, radio y perilla del
  slider son más pequeños a la vista pero amplían su área con un pseudo-elemento (`after:-inset-*`).
- **Foco visible** en todo control (`focus-visible:ring-2 ring-ring` + offset). Nunca `outline-none`
  sin reemplazo.
- **Etiquetas reales**: `Label`/`FormLabel`; botones de icono con `aria-label`; `NumberStepper` y
  `Slider` exponen nombre accesible (`label` / `aria-label` / `thumbLabels`).
- **Roles**: `ProgressRing` es `role="group"` con nombre y números visibles; `MacroBar` es
  `progressbar` con `aria-valuetext` ("85 de 120 g"); `NumberStepper` es `spinbutton`
  (↑/↓, RePág/AvPág, Inicio/Fin); `Alert` usa `alert` solo en `destructive`, si no `status`.
- **Navegación**: enlaces activos con `aria-current="page"`; enlace "Saltar al contenido" en los shells.
- **Estados de red**: `OfflineBanner` es una región `status` siempre montada.
- `lang="es-PE"` en `<html>`; `suppressHydrationWarning` por la clase de tema.

## 6. Utilidades propias (`globals.css`)
| Utilidad | Efecto |
|---|---|
| `pt-safe` `pb-safe` `pl-safe` `pr-safe` `px-safe` | Padding = `env(safe-area-inset-*)` |
| `pb-safe-N` `pt-safe-N` | Safe area + `N` del espaciado (`pb-safe-4` = inset + 1rem) |
| `bottom-safe-N` | `bottom` = safe area + `N` (posición de elementos flotantes) |
| `tap-highlight-none` | Quita el resaltado azul al tocar (ya es global en `html`) |
| `scrollbar-none` | Oculta la barra de scroll (carruseles horizontales) |
Requieren `viewportFit: "cover"` (ya en `src/app/layout.tsx`).

---

## 7. Componentes (`src/components/ui`)
Estilo shadcn: Radix (paquete `radix-ui`) + `cva` + `cn()`; `data-slot` en cada parte. Los que usan
estado o Radix interactivo llevan `"use client"`; `Button`, `Card`, `Badge`, `Input`, `Alert`,
`Skeleton`, `EmptyState`, `PageHeader`, `StatTile`, `MacroBar` funcionan en Server Components.

| Componente | Notas de uso |
|---|---|
| `Button` | `variant`: default (naranja), secondary, outline, ghost, destructive, link. `size`: sm, default, lg, icon, icon-sm. `asChild` para `<Link>`. `loading` muestra spinner, deshabilita y marca `aria-busy` (con `asChild` usa `aria-disabled`). Una sola acción `default` por vista. |
| `Input`, `Textarea`, `Label` | 48 px, 16 px de fuente, borde `input`, `aria-invalid` pinta el error. |
| `Form` + `FormField/Item/Label/Control/Description/Message` | React Hook Form + `zodResolver`. `FormControl` conecta `id`, `aria-describedby` y `aria-invalid`. |
| `Card` (+ Header, Title `as`, Description, Action, Content, Footer) | `rounded-2xl`, borde y `shadow-sm`. |
| `Badge` | default, secondary, soft, outline, success, warning, destructive. |
| `Separator`, `Skeleton`, `Spinner`, `Progress` | `Skeleton` es `aria-hidden`: el contenedor debe llevar `aria-busy`. |
| `Tabs` | Pestañas tipo píldora (lista 52 px). Para 2–4 vistas del mismo contenido. |
| `SegmentedControl` | Selector de una opción (Día/Semana/Mes). Siempre hay una activa; indicador animado. |
| `Dialog` | Modal centrado. `showCloseButton` (por defecto true, "Cerrar"). |
| `Sheet` | Panel lateral/superior (Radix Dialog), `side`: right, left, top, bottom. |
| `BottomSheet` | Hoja inferior móvil con `vaul` (arrastrar para cerrar), con asa y safe area. Úsala para acciones rápidas en móvil; en escritorio prefiere `Dialog`. |
| `DropdownMenu`, `Select`, `Tooltip` | Ítems de 44 px. Tooltip nunca contiene información imprescindible. |
| `Switch`, `Checkbox`, `RadioGroup`, `Slider` | Área táctil ampliada; `Slider` acepta `aria-label` o `thumbLabels`. |
| `Avatar` (+ `initials()`) | Fallback con iniciales sobre `accent`. |
| `Alert` | default, info, success, warning, destructive. Texto en foreground; color en borde/icono. |
| `Toaster` / `toast` | De `@/components/ui/sonner`. Arriba al centro (el borde inferior es de la barra). Mensajes en español, cortos; errores con el texto del `ActionResult`. |
| `NumberStepper` | Cantidades (g, ml, porciones). Botones −/+ de 56 px, teclado numérico (`inputMode`), acepta coma o punto, ajusta a `min`/`max` al confirmar. `decimals` por defecto según `step`. |
| `ProgressRing` | Anillo calórico: restante (grande), "consumido de meta". `goal` nulo → "Meta pendiente de definir" (no inventa). `getRingState()` es puro y reutilizable. |
| `MacroBar` (+ `MACROS`) | Barra por macro con color accesible; `MACROS[macro].bg/stroke/fill` para gráficos (Recharts). |
| `StatTile` | Métrica compacta (agua, peso, racha). `value` ya formateado; vacío → "—". |
| `EmptyState` | Vacío de listas: qué pasa + acción real (si no funciona, no se muestra). |
| `PageHeader` | Encabezado de página (marketing, admin, secciones amplias). `h1` por defecto. |
| `ThemeToggle` | Claro / Oscuro / Sistema (next-themes). Icono por CSS para evitar parpadeo. |

### Proveedores (`src/components/providers.tsx`)
`ThemeProvider` (next-themes, `attribute="class"`, `defaultTheme="system"`), `QueryClientProvider`
(TanStack Query: `staleTime` 60 s, `retry` 1, sin refetch al enfocar), `MotionConfig`,
`TooltipProvider` y `Toaster`. Montado una vez en `src/app/layout.tsx`.

## 8. Shells
Todos reciben `appName` por props: el layout de cada zona lo obtiene con `getAppSettings()`
(`src/lib/config/app-settings.ts`) y lo pasa. Los shells no leen la BD ni validan sesión/rol.

- **`AppShell`** (`src/components/app/app-shell.tsx`): móvil con barra inferior fija (Inicio,
  Diario, Plan, Progreso, Perfil) y botón **"+"** flotante centrado sobre la barra que abre un
  `BottomSheet` con 8 accesos (buscar, foto, voz, texto, código, agua, actividad, ayuno). En
  escritorio (≥ lg) barra lateral de 18 rem con las mismas secciones + Recetas, Compras, Asistente,
  Logros, botón "Registrar" (abre los mismos accesos en `Dialog`) y selector de tema. Rutas y
  orden en `src/components/app/nav-items.ts` (`isNavItemActive` resuelve el ítem activo).
  `<main id="contenido">` ya tiene `px-4` y margen inferior para la barra.
- **`AppHeader`**: primer hijo del contenido de cada pantalla; título (`h1`), subtítulo, acciones
  y `backHref` opcional. Pegajoso arriba, translúcido, con `pt-safe`.
- **`OfflineBanner`**: `navigator.onLine` + eventos. Solo informa; no promete sincronización.
- **`SiteHeader` / `SiteFooter`** (marketing): navegación Funciones / Precios / Preguntas,
  Ingresar y Crear cuenta; menú móvil en `Sheet`. El pie lleva legales, contacto (`supportEmail`;
  si no está configurado lo dice) y el aviso "no reemplaza a un profesional de la salud".
- **`AdminShell`**: barra lateral (Dashboard, Usuarios, Alimentos, Recetas, Contenidos, Planes y
  precios, IA, Configuración, Auditoría, Errores) y, en móvil/tablet, barra superior con menú en
  `Sheet`. La autorización la hace el layout de `/admin` con `requireRole`.

## 9. Marca
`Logo` / `LogoMark` (`src/components/brand/logo.tsx`): marca propia en SVG — un anillo de progreso
naranja casi cerrado con un punto en el hueco ("avanzas hacia tu meta"). El arco usa
`brand-orange` en ambos temas y el punto hereda `currentColor` (carbón en claro, blanco suave en
oscuro). El nombre es texto real y llega por `appName` (configurable). No recolorear el arco, no
rotarlo ni añadirle efectos. Tamaño mínimo de la marca: 20 px.

## 10. Reglas rápidas
- Naranja de relleno: `bg-primary text-primary-foreground`. Naranja de texto: `text-primary-strong`.
- Nada de rojo para comer de más. `destructive` solo para borrar, errores reales y validación.
- Cada lista: vacío (`EmptyState`), carga (`Skeleton` + `aria-busy`) y error (`Alert destructive`).
- Controles que aún no funcionan: no se muestran o van `disabled` con el motivo visible.
- Iconos `lucide-react` (`size-5` por defecto en botones), siempre `aria-hidden` si hay texto.

## 11. Pendientes conocidos
- `src/app/layout.tsx` declara `manifest: "/manifest.webmanifest"`, pero el manifest, los iconos
  PWA y las imágenes OG los crea el módulo de PWA/landing (fase 7); hasta entonces esa URL da 404.
- `themeColor` sigue la preferencia del sistema (meta `media`), no el tema elegido manualmente.
