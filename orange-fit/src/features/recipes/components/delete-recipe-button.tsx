"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { deleteRecipeAction } from "../actions";

/** Eliminar una receta propia, con confirmación. Lo ya registrado en el diario se conserva. */
export function DeleteRecipeButton({ recipeId, title }: { recipeId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <>
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Eliminar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar “{title}”?</DialogTitle>
            <DialogDescription>
              No se puede deshacer. Lo que ya registraste en tu diario se conserva; en tus planes, esa comida quedará como “receta no disponible”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteRecipeAction({ recipeId });
                  if (!res.ok) {
                    toast.error(res.error.message);
                    return;
                  }
                  toast.success("Receta eliminada");
                  setOpen(false);
                  router.push("/app/recetas");
                })
              }
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
