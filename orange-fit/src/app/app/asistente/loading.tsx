import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando el asistente" className="flex flex-col gap-4 pt-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="flex justify-between">
        <Skeleton className="h-11 w-36 rounded-xl" />
        <Skeleton className="h-11 w-24 rounded-xl" />
      </div>
      <Skeleton className="ml-auto h-14 w-3/4 rounded-2xl" />
      <Skeleton className="h-24 w-4/5 rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
