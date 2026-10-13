import { Skeleton } from "@/components/ui/skeleton";

/** Carga de una sección del panel: encabezado, filtros y lista/tabla. */
export function AdminLoading({ variant = "table" }: { variant?: "table" | "tiles" | "form" }) {
  return (
    <div aria-busy="true" className="grid gap-6">
      <span className="sr-only">Cargando…</span>
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {variant === "tiles" ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </>
      ) : variant === "form" ? (
        <div className="grid gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="grid gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      ) : (
        <>
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid gap-2">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
