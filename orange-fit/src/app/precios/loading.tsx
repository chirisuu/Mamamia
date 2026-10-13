import { Skeleton } from "@/components/ui/skeleton";

export default function PricingLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6">
      <span className="sr-only">Cargando precios…</span>
      <div className="mx-auto grid w-full max-w-2xl justify-items-center gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="mx-auto h-13 w-full max-w-sm rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    </div>
  );
}
