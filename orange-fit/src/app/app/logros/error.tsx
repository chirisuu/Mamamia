"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function AchievementsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Logros" backHref="/app/progreso" retry={retry} />;
}
