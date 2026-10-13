import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { EMPTY_OFFICIAL_RECIPE, OfficialRecipeForm } from "@/features/admin/components/official-recipe-form";

export const metadata: Metadata = { title: "Nueva receta oficial" };

export default async function NewOfficialRecipePage() {
  await requireRole("editor");
  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/recetas">
            <ChevronLeft aria-hidden="true" />
            Recetas
          </Link>
        </Button>
      </div>
      <PageHeader eyebrow="Recetas" title="Nueva receta oficial" description="Créala como borrador; la imagen se sube después de guardarla." />
      <OfficialRecipeForm initial={EMPTY_OFFICIAL_RECIPE} foods={{}} />
    </div>
  );
}
