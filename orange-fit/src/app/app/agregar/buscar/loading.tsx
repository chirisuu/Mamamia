import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando buscador" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-13 w-full rounded-2xl" />
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
