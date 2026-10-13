import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando alimentos" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-13 w-full rounded-2xl" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}
