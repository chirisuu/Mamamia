import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando formulario" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-xl" />
      ))}
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
