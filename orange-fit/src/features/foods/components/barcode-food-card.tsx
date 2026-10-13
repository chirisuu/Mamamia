import { ExternalLink, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FoodDetail } from "@/lib/foods/api-types";
import { BARCODE_FORMAT_LABELS, type BarcodeFormat } from "@/lib/foods/barcode";
import { provenanceLabel } from "@/lib/foods/types";
import { formatNumber } from "@/lib/format";

type Row = { label: string; value: number | null | undefined; unit: string; decimals?: number; indent?: boolean };

function NutrientRow({ label, value, unit, decimals = 1, indent }: Row) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={indent ? "pl-4 text-sm text-muted-foreground" : "text-sm text-foreground"}>{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">
        {value == null ? <span className="font-normal text-muted-foreground">sin dato</span> : `${formatNumber(value, decimals)} ${unit}`}
      </dd>
    </div>
  );
}

export type BarcodeFoodCardProps = {
  food: FoodDetail;
  origin: "database" | "open_food_facts";
  barcode: { code: string; format: BarcodeFormat };
};

/** Producto encontrado: nutrientes por 100 g, procedencia y atribución de la fuente. */
export function BarcodeFoodCard({ food, origin, barcode }: BarcodeFoodCardProps) {
  const n = food.per100g;
  const isOff = food.source === "open_food_facts";
  const unverified = food.verificationStatus === "unverified";
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h2" className="text-lg">
          {food.name}
        </CardTitle>
        <CardDescription>
          {food.brandName ? `${food.brandName} · ` : ""}
          <span className="tabular-nums">
            {BARCODE_FORMAT_LABELS[barcode.format]} {barcode.code}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant={food.verificationStatus === "verified" ? "success" : "soft"}>
            {food.verificationStatus === "verified" ? <ShieldCheck aria-hidden="true" /> : null}
            {provenanceLabel(food)}
          </Badge>
          {food.isOwn ? <Badge variant="outline">Tu alimento</Badge> : null}
          {origin === "open_food_facts" ? <Badge variant="outline">Recién agregado a la base</Badge> : null}
        </div>

        <section aria-labelledby="per100">
          <h3 id="per100" className="text-sm font-semibold">
            Por 100 g
          </h3>
          <dl className="mt-1 divide-y divide-border">
            <NutrientRow label="Energía" value={n.energyKcal} unit="kcal" decimals={0} />
            <NutrientRow label="Proteína" value={n.proteinG} unit="g" />
            <NutrientRow label="Carbohidratos" value={n.carbsG} unit="g" />
            <NutrientRow label="Azúcares" value={n.sugarG} unit="g" indent />
            <NutrientRow label="Fibra" value={n.fiberG} unit="g" indent />
            <NutrientRow label="Grasa" value={n.fatG} unit="g" />
            <NutrientRow label="Grasa saturada" value={n.saturatedFatG} unit="g" indent />
            <NutrientRow label="Sodio" value={n.sodiumMg} unit="mg" decimals={0} />
          </dl>
        </section>

        {food.micronutrients.length > 0 ? (
          <details className="group rounded-xl bg-muted/60 px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Vitaminas y minerales ({food.micronutrients.length})
            </summary>
            <dl className="divide-y divide-border pb-2">
              {food.micronutrients.map((m) => (
                <NutrientRow key={m.code} label={m.name} value={m.amountPer100g} unit={m.unit} decimals={m.amountPer100g < 10 ? 2 : 0} />
              ))}
            </dl>
          </details>
        ) : null}

        {unverified ? (
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Valores aún no verificados por el equipo: compáralos con la etiqueta si tienes dudas.</span>
          </p>
        ) : null}
        {food.description ? <p className="text-xs text-muted-foreground">{food.description}</p> : null}

        {isOff || food.sourceUrl ? (
          <p className="text-xs text-muted-foreground">
            {isOff ? "Datos de Open Food Facts, licencia ODbL (© colaboradores de Open Food Facts)." : food.license ? `Licencia: ${food.license}.` : null}{" "}
            {food.sourceUrl ? (
              <a
                href={food.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-medium text-primary-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver la fuente
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            ) : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
