"use client";

import { RouteError } from "@/features/progress/components/route-error";
import { useReportError } from "@/features/marketing/use-report-error";

export default function FastingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return <RouteError title="Ayuno" backHref="/app" retry={retry} />;
}
