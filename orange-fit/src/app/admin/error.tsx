"use client";

import { AdminErrorView } from "@/features/admin/components/admin-error";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <AdminErrorView retry={retry} digest={error.digest} />;
}
