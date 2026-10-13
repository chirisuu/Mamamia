import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando el escáner" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-4 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-12 flex-1 rounded-xl" />
        <Skeleton className="h-12 w-28 rounded-xl" />
      </div>
    </div>
  );
}
