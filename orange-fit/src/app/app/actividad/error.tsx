"use client";

import { RouteError } from "@/features/progress/components/route-error";
import { useReportError } from "@/features/marketing/use-report-error";

export default function ActivityError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return <RouteError title="Actividad" backHref="/app" retry={retry} />;
}
