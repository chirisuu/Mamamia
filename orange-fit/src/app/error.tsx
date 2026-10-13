"use client";

import { ErrorScreen } from "@/features/marketing/components/error-screen";

/**
 * Error no controlado en cualquier página que no tenga su propio error.tsx (sitio público, acceso,
 * onboarding…). Se pinta dentro del layout raíz (tema y proveedores activos).
 */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorScreen error={error} onRetry={retry} />;
}
