import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando tus fotos" className="grid gap-4 pt-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
