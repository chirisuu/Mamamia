import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Cargando plan compartido" className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-8">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-2/3" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
      ))}
    </div>
  );
}
