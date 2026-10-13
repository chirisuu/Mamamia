import type { Metadata } from "next";
import { Tag, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { requireRole } from "@/lib/auth/session";
import { todayInTz } from "@/lib/dates";
import { formatMoney, formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteReferencePriceAction } from "@/features/admin/actions/foods";
import { ConfirmActionButton } from "@/features/admin/components/action-buttons";
import { Field, FilterBar, formatDateOnly, pageParam, Pagination, stringParam } from "@/features/admin/components/admin-ui";
import { FoodsNav } from "@/features/admin/components/foods-nav";
import { PriceDialog } from "@/features/admin/components/price-form";
import { PRICE_UNIT_LABELS, PRICE_UNITS } from "@/features/admin/lib/labels";
import { listReferencePrices, PRICES_PER_PAGE } from "@/features/admin/server/foods";

export const metadata: Metadata = { title: "Precios referenciales" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const unitLabel = (u: string) => (PRICE_UNITS as readonly string[]).includes(u) ? PRICE_UNIT_LABELS[u as (typeof PRICE_UNITS)[number]] : u;
const asUnit = (u: string): (typeof PRICE_UNITS)[number] => ((PRICE_UNITS as readonly string[]).includes(u) ? (u as (typeof PRICE_UNITS)[number]) : "kg");

export default async function ReferencePricesPage({ searchParams }: Props) {
  await requireRole("editor");
  const sp = await searchParams;
  const q = stringParam(sp.q, 100);
  const currency = stringParam(sp.moneda, 3)?.toUpperCase() ?? null;
  const page = pageParam(sp.page);
  const supabase = await createSupabaseServerClient();
  const { rows, total } = await listReferencePrices(supabase, { q, currency, page });
  const today = todayInTz("America/Lima");

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Alimentos"
        title="Precios referenciales"
        description="Precios observados para estimar el costo de recetas y listas de compras. Siempre con fuente y fecha: nunca se presentan como precios actuales."
        actions={
          <PriceDialog
            mode="create"
            initial={{ id: null, foodId: null, itemName: "", countryCode: "PE", currencyCode: "PEN", price: null as unknown as number, perQuantity: 1, perUnit: "kg", source: "", observedOn: today }}
          />
        }
      />
      <FoodsNav current="/admin/alimentos/precios" />
      <FilterBar action="/admin/alimentos/precios" clearHref={q || currency ? "/admin/alimentos/precios" : undefined}>
        <Field label="Producto" htmlFor="q" className="sm:col-span-2 lg:col-span-2">
          <Input id="q" name="q" type="search" defaultValue={q ?? ""} placeholder="Pollo, arroz…" autoComplete="off" />
        </Field>
        <Field label="Moneda" htmlFor="moneda">
          <Input id="moneda" name="moneda" defaultValue={currency ?? ""} placeholder="PEN" maxLength={3} autoComplete="off" className="uppercase" />
        </Field>
      </FilterBar>

      {rows.length === 0 ? (
        <EmptyState icon={Tag} title={q || currency ? "Ningún precio coincide" : "Todavía no hay precios"} description="Agrega precios observados con su fuente y fecha." />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" data-numeric="">
            {formatNumber(total)} {total === 1 ? "precio" : "precios"}
          </p>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="truncate font-medium">{p.item_name}</p>
                  <p className="text-sm" data-numeric="">
                    {formatMoney(Number(p.price), p.currency_code)} por {formatNumber(Number(p.per_quantity), 2)} {unitLabel(p.per_unit)} · {p.country_code}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateOnly(`${p.observed_on}T12:00:00Z`)} · {p.source}
                    {p.foodName ? ` · vinculado a «${p.foodName}»` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <PriceDialog
                    mode="edit"
                    initial={{
                      id: p.id,
                      foodId: p.food_id,
                      foodName: p.foodName,
                      itemName: p.item_name,
                      countryCode: p.country_code,
                      currencyCode: p.currency_code,
                      price: Number(p.price),
                      perQuantity: Number(p.per_quantity),
                      perUnit: asUnit(p.per_unit),
                      source: p.source ?? "",
                      observedOn: p.observed_on,
                    }}
                  />
                  <ConfirmActionButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Eliminar precio de ${p.item_name}`}
                    action={deleteReferencePriceAction.bind(null, { id: p.id })}
                    successMessage="Precio eliminado."
                    title="¿Eliminar este precio?"
                    description={<p>Las listas de compras que ya lo usaron conservan su estimación.</p>}
                    confirmLabel="Sí, eliminar"
                    destructive
                  >
                    <Trash2 aria-hidden="true" />
                  </ConfirmActionButton>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} total={total} perPage={PRICES_PER_PAGE} basePath="/admin/alimentos/precios" params={{ q, moneda: currency }} />
        </>
      )}
    </div>
  );
}
