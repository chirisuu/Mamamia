import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-48" />
    </div>
  );
}
