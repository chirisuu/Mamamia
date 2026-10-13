"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { generateShoppingListAction } from "../actions";

/** Crear una lista de compras a partir de un plan guardado. */
export function GenerateListForm({ plans }: { plans: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [planId, setPlanId] = React.useState(plans[0]?.id ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!planId) return;
        setError(null);
        startTransition(async () => {
          const res = await generateShoppingListAction({ planId });
          if (!res.ok) {
            setError(res.error.message);
            return;
          }
          toast.success(res.data.unpriced ? `Lista creada (${res.data.unpriced} ítems sin precio referencial)` : "Lista creada");
          router.push(`/app/compras/${res.data.id}`);
        });
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="list-plan">Plan</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger id="list-plan">
            <SelectValue placeholder="Elige un plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={!planId}>
        <ShoppingBasket aria-hidden="true" />
        Crear lista de compras
      </Button>
    </form>
  );
}
