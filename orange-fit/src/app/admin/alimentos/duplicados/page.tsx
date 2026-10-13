import type { Metadata } from "next";
import Link from "next/link";
import { CopyCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { findDuplicateCandidates } from "@/lib/foods/dedup";
import type { FoodSummary } from "@/lib/foods/types";
import { formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mergeFoodsAction } from "@/features/admin/actions/foods";
import { ConfirmActionButton } from "@/features/admin/components/action-buttons";
import { buildHref, SubNav } from "@/features/admin/components/admin-ui";
import { FoodsNav } from "@/features/admin/components/foods-nav";
import { FOOD_SOURCE_LABELS, VERIFICATION_LABELS } from "@/features/admin/lib/labels";
import { formatPercent } from "@/features/admin/lib/metrics";

export const metadata: Metadata = { title: "Alimentos duplicados" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const THRESHOLDS = [
  { value: "0.9", label: "Muy parecidos" },
  { value: "0.8", label: "Parecidos" },
  { value: "0.7", label: "Posibles" },
] as const;

function FoodCard({ food, other, label }: { food: FoodSummary; other: FoodSummary; label: string }) {
  const m = food.per100g;
  return (
    <div className="grid content-start gap-2 rounded-xl border border-border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <Link href={`/admin/alimentos/${food.id}`} className="font-medium text-primary-strong underline-offset-4 hover:underline">
        {food.name}
        {food.brandName ? <span className="font-normal text-muted-foreground"> · {food.brandName}</span> : null}
      </Link>
      <p className="text-xs text-muted-foreground" data-numeric="">
        {formatNumber(m.energyKcal)} kcal · P {formatNumber(m.proteinG, 1)} · C {formatNumber(m.carbsG, 1)} · G {formatNumber(m.fatG, 1)} g por 100 g
        {food.barcode ? ` · ${food.barcode}` : ""}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{FOOD_SOURCE_LABELS[food.source]}</Badge>
        <Badge variant="outline">{VERIFICATION_LABELS[food.verificationStatus]}</Badge>
      </div>
      <ConfirmActionButton
        size="sm"
        variant="outline"
        className="mt-1 justify-self-start"
        action={mergeFoodsAction.bind(null, { keepId: food.id, dropId: other.id })}
        successMessage="Alimentos fusionados."
        title="¿Fusionar estos alimentos?"
        description={
          <>
            <p>
              Se conserva <strong>«{food.name}»</strong>. Las recetas, favoritos, plantillas, planes, listas de compras y precios que usan «{other.name}» pasarán a
              usar el conservado.
            </p>
            <p>«{other.name}» saldrá del catálogo (rechazado). Los registros del diario no cambian: guardan su propia copia.</p>
          </>
        }
        confirmLabel="Sí, fusionar"
      >
        Conservar este
      </ConfirmActionButton>
    </div>
  );
}

export default async function FoodDuplicatesPage({ searchParams }: Props) {
  await requireRole("editor");
  const sp = await searchParams;
  const raw = Array.isArray(sp.umbral) ? sp.umbral[0] : sp.umbral;
  const threshold = THRESHOLDS.find((t) => t.value === raw)?.value ?? "0.8";
  const supabase = await createSupabaseServerClient();
  // Candidatos con la sesión del staff (RLS): solo alimentos públicos no rechazados.
  const pairs = await findDuplicateCandidates(supabase, { limit: 50, threshold: Number(threshold) });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Alimentos"
        title="Posibles duplicados"
        description="Pares con nombre parecido, misma marca (o sin marca) y macros cercanos. Nada se fusiona solo: tú eliges cuál se conserva."
      />
      <FoodsNav current="/admin/alimentos/duplicados" />
      <SubNav
        label="Nivel de parecido"
        current={buildHref("/admin/alimentos/duplicados", { umbral: threshold === "0.8" ? null : threshold })}
        items={THRESHOLDS.map((t) => ({ href: buildHref("/admin/alimentos/duplicados", { umbral: t.value === "0.8" ? null : t.value }), label: t.label }))}
      />
      {pairs.length === 0 ? (
        <EmptyState icon={CopyCheck} title="No encontramos duplicados" description="Con este nivel de parecido no hay pares candidatos." />
      ) : (
        <ul className="grid gap-4">
          {pairs.map((pair) => (
            <li key={`${pair.a.id}-${pair.b.id}`} className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="text-sm font-medium" data-numeric="">
                Parecido: {formatPercent(pair.similarity, 0)}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <FoodCard food={pair.a} other={pair.b} label="Alimento A" />
                <FoodCard food={pair.b} other={pair.a} label="Alimento B" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
