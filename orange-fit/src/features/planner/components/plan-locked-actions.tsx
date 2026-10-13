"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Link2Off, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { deletePlanAction, revokeShareAction } from "../actions";

/** Sin Premium la persona igual puede desactivar el enlace público y borrar su plan. */
export function PlanLockedActions({ planId, shared }: { planId: string; shared: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [isShared, setIsShared] = React.useState(shared);
  return (
    <div className="flex flex-wrap gap-2">
      {isShared ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await revokeShareAction({ planId });
              if (!res.ok) return void toast.error(res.error.message);
              setIsShared(false);
              toast.success("Enlace desactivado");
            })
          }
        >
          <Link2Off aria-hidden="true" />
          Desactivar enlace público
        </Button>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("¿Eliminar este plan? No se puede deshacer.")) return;
          startTransition(async () => {
            const res = await deletePlanAction({ planId });
            if (!res.ok) return void toast.error(res.error.message);
            toast.success("Plan eliminado");
            router.push("/app/plan");
          });
        }}
      >
        <Trash2 aria-hidden="true" />
        Eliminar plan
      </Button>
    </div>
  );
}
