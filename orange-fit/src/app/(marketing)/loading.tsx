import { Skeleton } from "@/components/ui/skeleton";

/** Carga de las páginas públicas (el encabezado y el pie ya están pintados). */
export default function MarketingLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:py-20">
      <span className="sr-only">Cargando…</span>
      <div className="grid max-w-2xl gap-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full sm:h-12" />
        <Skeleton className="h-10 w-3/4 sm:h-12" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-5/6" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
