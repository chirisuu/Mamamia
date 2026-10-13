import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="grid gap-6">
      <span className="sr-only">Cargando…</span>
      <div className="grid gap-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-12 w-full rounded-xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
