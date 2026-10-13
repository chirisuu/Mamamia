"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function FastingError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Ayuno" backHref="/app" retry={retry} />;
}
