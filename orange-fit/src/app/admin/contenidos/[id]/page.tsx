import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/features/admin/components/admin-ui";
import { ContentEditor } from "@/features/admin/components/content-editor";
import { CONTENT_KINDS, LEGAL_SLUGS } from "@/features/admin/lib/labels";
import { getContentPage } from "@/features/admin/server/content";

export const metadata: Metadata = { title: "Editar contenido" };

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dirección pública del contenido, solo si el sitio de verdad lo muestra. */
function publicPath(kind: string, slug: string): string | null {
  if (kind === "faq") return "/faq";
  if (kind === "legal" && (LEGAL_SLUGS as readonly string[]).includes(slug)) return `/legal/${slug}`;
  return null;
}

export default async function EditContentPage({ params }: Props) {
  await requireRole("editor");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createSupabaseServerClient();
  const page = await getContentPage(supabase, id);
  if (!page) notFound();
  const kind = CONTENT_KINDS.find((k) => k === page.kind) ?? "article";
  const href = page.status === "published" ? publicPath(kind, page.slug) : null;

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
      <PageHeader
        eyebrow="Editar contenido"
        title={page.title}
        description={`Última modificación: ${formatDateTime(page.updated_at)}.`}
        actions={
          href ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" />
                Ver en el sitio
              </Link>
            </Button>
          ) : null
        }
      />
      <ContentEditor
        key={page.updated_at}
        initial={{
          id: page.id,
          slug: page.slug,
          title: page.title,
          kind,
          status: page.status === "published" ? "published" : "draft",
          sortOrder: page.sort_order,
          bodyMd: page.body_md,
        }}
      />
    </div>
  );
}
