"use client";

import { AdminErrorView } from "@/features/admin/components/admin-error";
import { useReportError } from "@/features/marketing/use-report-error";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useReportError(error);
  return <AdminErrorView retry={retry} digest={error.digest} />;
}
