import { SubNav } from "./admin-ui";

export const FOODS_SECTIONS = [
  { href: "/admin/alimentos", label: "Catálogo" },
  { href: "/admin/alimentos/verificacion", label: "Verificación" },
  { href: "/admin/alimentos/duplicados", label: "Duplicados" },
  { href: "/admin/alimentos/importar", label: "Importar USDA" },
  { href: "/admin/alimentos/precios", label: "Precios" },
] as const;

/** Sub-navegación de la sección Alimentos (con el conteo de la cola de verificación). */
export function FoodsNav({ current, pending }: { current: (typeof FOODS_SECTIONS)[number]["href"]; pending?: number | null }) {
  return (
    <SubNav
      label="Secciones de alimentos"
      current={current}
      items={FOODS_SECTIONS.map((s) => ({ ...s, count: s.href === "/admin/alimentos/verificacion" ? pending : null }))}
    />
  );
}
