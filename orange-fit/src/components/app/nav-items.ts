import {
  Activity,
  CalendarDays,
  Camera,
  ChartLine,
  ChefHat,
  Droplet,
  House,
  Mic,
  NotebookPen,
  ScanBarcode,
  Search,
  ShoppingBasket,
  Sparkles,
  Timer,
  Trophy,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo activo con la ruta exacta (p. ej. /app, que es prefijo de todo). */
  exact?: boolean;
};

export type QuickAddAction = NavItem & { description: string };

/** Barra inferior (móvil) y bloque principal de la barra lateral (escritorio). */
export const APP_PRIMARY_NAV: readonly NavItem[] = [
  { href: "/app", label: "Inicio", icon: House, exact: true },
  { href: "/app/diario", label: "Diario", icon: NotebookPen },
  { href: "/app/plan", label: "Plan", icon: CalendarDays },
  { href: "/app/progreso", label: "Progreso", icon: ChartLine },
  { href: "/app/perfil", label: "Perfil", icon: UserRound },
];

/** Solo en la barra lateral de escritorio; en móvil se llega desde Inicio/Plan/Perfil. */
export const APP_SECONDARY_NAV: readonly NavItem[] = [
  { href: "/app/recetas", label: "Recetas", icon: ChefHat },
  { href: "/app/compras", label: "Compras", icon: ShoppingBasket },
  { href: "/app/asistente", label: "Asistente", icon: Sparkles },
  { href: "/app/logros", label: "Logros", icon: Trophy },
];

/** Accesos del botón "+". Lo que viene de IA nunca se guarda sin confirmación (ver CONVENTIONS). */
export const QUICK_ADD_ACTIONS: readonly QuickAddAction[] = [
  { href: "/app/agregar/buscar", label: "Buscar alimento", description: "En la base de alimentos", icon: Search },
  { href: "/app/agregar/foto", label: "Foto", description: "La IA sugiere, tú confirmas", icon: Camera },
  { href: "/app/agregar/voz", label: "Voz", description: "Dicta lo que comiste", icon: Mic },
  { href: "/app/agregar/texto", label: "Texto", description: "Descríbelo con tus palabras", icon: Type },
  { href: "/app/agregar/codigo", label: "Código de barras", description: "Escanea un envase", icon: ScanBarcode },
  { href: "/app/agua", label: "Agua", description: "Suma lo que tomaste", icon: Droplet },
  { href: "/app/actividad", label: "Actividad", description: "Registra tu ejercicio", icon: Activity },
  { href: "/app/ayuno", label: "Ayuno", description: "Controla tu ventana", icon: Timer },
];

/** ¿La ruta actual corresponde a este ítem? /app/diario/2026-10-13 activa "Diario". */
export function isNavItemActive(pathname: string | null, item: Pick<NavItem, "href" | "exact">): boolean {
  if (!pathname) return false;
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (item.exact) return path === item.href;
  return path === item.href || path.startsWith(`${item.href}/`);
}
