import { Skeleton } from "@/components/ui/skeleton";

export default function ProfileLoading() {
  return (
    <div aria-busy="true" className="grid gap-6 pt-4">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
