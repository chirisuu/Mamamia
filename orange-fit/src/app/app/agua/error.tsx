"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function WaterError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Agua" backHref="/app" retry={retry} />;
}
