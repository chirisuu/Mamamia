"use client";

import { RouteError } from "@/features/progress/components/route-error";

export default function NotificationsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError title="Notificaciones" backHref="/app" retry={retry} />;
}
