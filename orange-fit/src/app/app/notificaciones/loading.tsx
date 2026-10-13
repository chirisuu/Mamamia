import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando notificaciones" className="grid gap-4 pt-4">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-2 rounded-2xl border border-border p-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
