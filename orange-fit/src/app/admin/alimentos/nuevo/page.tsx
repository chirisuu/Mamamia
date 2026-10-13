import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { EMPTY_FOOD, FoodForm } from "@/features/admin/components/food-form";

export const metadata: Metadata = { title: "Nuevo alimento" };

export default async function NewFoodPage() {
  await requireRole("editor");
  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/alimentos">
            <ChevronLeft aria-hidden="true" />
            Alimentos
          </Link>
        </Button>
      </div>
      <PageHeader eyebrow="Alimentos" title="Nuevo alimento" description="Valores por 100 g de una fuente verificable. Nada estimado sin decirlo." />
      <FoodForm initial={EMPTY_FOOD} />
    </div>
  );
}
