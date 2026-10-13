"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function ProgressPhotosError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Fotos de progreso" backHref="/app/progreso" retry={retry} />;
}
