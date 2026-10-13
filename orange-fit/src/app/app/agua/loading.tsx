import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando agua" className="grid gap-4 pt-4 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
