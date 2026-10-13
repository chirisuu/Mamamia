import { Skeleton } from "@/components/ui/skeleton";

export default function PremiumThanksLoading() {
  return (
    <div aria-busy="true" className="mx-auto grid w-full max-w-lg gap-6 pt-6">
      <span className="sr-only">Revisando tu pago…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-14 w-full rounded-xl" />
    </div>
  );
}
