import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando lista de compras" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ))}
    </div>
  );
}
