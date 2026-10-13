"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function ProgressError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Progreso" retry={retry} />;
}
