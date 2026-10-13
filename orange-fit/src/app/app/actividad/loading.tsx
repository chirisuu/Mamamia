import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando tu actividad" className="grid gap-4 pt-4 lg:grid-cols-2">
      <div className="grid content-start gap-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-[28rem] w-full rounded-2xl" />
      </div>
      <div className="grid content-start gap-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  );
}
