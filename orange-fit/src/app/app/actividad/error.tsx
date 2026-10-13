"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function ActivityError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Actividad" backHref="/app" retry={retry} />;
}
