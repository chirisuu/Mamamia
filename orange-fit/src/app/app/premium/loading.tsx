import { Skeleton } from "@/components/ui/skeleton";

export default function PremiumLoading() {
  return (
    <div aria-busy="true" className="grid gap-6 pt-4">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-13 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
