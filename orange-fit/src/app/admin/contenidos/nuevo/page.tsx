import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { enumParam } from "@/features/admin/components/admin-ui";
import { ContentEditor } from "@/features/admin/components/content-editor";
import { CONTENT_KINDS } from "@/features/admin/lib/labels";

export const metadata: Metadata = { title: "Nuevo contenido" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function NewContentPage({ searchParams }: Props) {
  await requireRole("editor");
  const kind = enumParam((await searchParams).tipo, CONTENT_KINDS) ?? "faq";
  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/contenidos">
            <ChevronLeft aria-hidden="true" />
            Contenidos
          </Link>
        </Button>
      </div>
      <PageHeader eyebrow="Contenidos" title="Nuevo contenido" description="Se crea como borrador salvo que lo marques como publicado." />
      <ContentEditor initial={{ id: null, slug: "", title: "", kind, status: "draft", sortOrder: 100, bodyMd: "" }} />
    </div>
  );
}
