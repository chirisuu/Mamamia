"use client";

import * as React from "react";
import { UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { revokeProfessionalAccess } from "../actions";
import { SCOPE_LABELS, type ProfessionalScope } from "../schemas";

export type AccessItem = {
  id: string;
  name: string;
  email: string | null;
  scope: string;
  grantedAt: string;
  revokedAt: string | null;
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });

export function AccessList({ items }: { items: AccessItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={UserRoundCheck}
        title="Nadie tiene acceso a tus datos"
        description="Cuando des acceso a tu nutricionista, aparecerá aquí y podrás retirarlo cuando quieras."
      />
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            {item.email && item.email !== item.name ? <p className="truncate text-sm text-muted-foreground">{item.email}</p> : null}
            <p className="text-xs text-muted-foreground">
              {SCOPE_LABELS[item.scope as ProfessionalScope]?.label ?? item.scope} · desde {fmt(item.grantedAt)}
              {item.revokedAt ? ` · retirado el ${fmt(item.revokedAt)}` : ""}
            </p>
          </div>
          {item.revokedAt ? <Badge variant="outline">Retirado</Badge> : <RevokeButton item={item} />}
        </li>
      ))}
    </ul>
  );
}

function RevokeButton({ item }: { item: AccessItem }) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Retirar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Retirar el acceso de {item.name}?</DialogTitle>
          <DialogDescription>
            Dejará de ver tus datos desde ahora. Las metas que ya fijó se mantienen hasta que las cambies.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await revokeProfessionalAccess({ id: item.id });
                if (result.ok) {
                  toast.success("Acceso retirado.");
                  setOpen(false);
                } else toast.error(result.error.message);
              })
            }
          >
            Retirar acceso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
