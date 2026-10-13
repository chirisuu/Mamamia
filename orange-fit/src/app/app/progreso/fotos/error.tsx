"use client";

import { RouteError } from "@/features/progress/components/route-error";
import { useReportError } from "@/features/marketing/use-report-error";

export default function ProgressPhotosError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return <RouteError title="Fotos de progreso" backHref="/app/progreso" retry={retry} />;
}
