import Link from "next/link";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MacroBar } from "@/components/ui/macro-bar";
import type { DashboardData } from "../queries";

export function MacrosCard({ consumed, target, today }: Pick<DashboardData, "consumed" | "target" | "today">) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle as="h2">Macros</CardTitle>
        <CardAction>
          <Link
            href={`/app/diario/${today}`}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
          >
            Ver diario
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <MacroBar macro="protein" consumed={consumed.proteinG} goal={target?.proteinG} />
        <MacroBar macro="carbs" consumed={consumed.carbsG} goal={target?.carbsG} />
        <MacroBar macro="fat" consumed={consumed.fatG} goal={target?.fatG} />
        <div className="grid gap-1">
          <MacroBar macro="fiber" consumed={consumed.fiberG} goal={target?.fiberG} />
          {consumed.fiberIncomplete && consumed.itemsCount ? (
            <p className="text-xs text-muted-foreground">Mínimo: algunos alimentos de hoy no tienen dato de fibra.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
