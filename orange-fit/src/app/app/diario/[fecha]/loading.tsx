import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando diario" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-2xl" />
      ))}
    </div>
  );
}
