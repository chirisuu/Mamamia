"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { setUserRoleAction } from "../actions/users";
import { GRANTABLE_ROLES, ROLE_LABELS, type GrantableRole } from "../lib/labels";

const ROLE_HELP: Record<GrantableRole, string> = {
  editor: "Alimentos, recetas y contenidos.",
  admin: "Además usuarios, planes, configuración, IA, auditoría y errores.",
  professional: "Nutricionista: puede ver registros de quien le dé acceso.",
};

/**
 * Roles de una cuenta (solo superadmin). Cada cambio pide confirmación y queda en la auditoría.
 * `superadmin` no se otorga aquí: solo por SQL.
 */
export function RoleManager({ userId, email, roles }: { userId: string; email: string | null; roles: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pendingChange, setPendingChange] = React.useState<{ role: GrantableRole; grant: boolean } | null>(null);
  const [saving, startSaving] = React.useTransition();
  const who = email ?? "esta cuenta";

  function confirm() {
    if (!pendingChange) return;
    const change = pendingChange;
    startSaving(async () => {
      const result = await setUserRoleAction({ userId, role: change.role, grant: change.grant });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(
        result.data.changed
          ? `${change.grant ? "Rol otorgado" : "Rol quitado"}: ${ROLE_LABELS[change.role]}.`
          : "No había nada que cambiar.",
      );
      setPendingChange(null);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck aria-hidden="true" />
        Roles
      </Button>
      <Dialog open={open} onOpenChange={(next) => !saving && (setOpen(next), next || setPendingChange(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roles de {who}</DialogTitle>
            <DialogDescription>
              {roles.includes("superadmin") ? "Es superadmin (solo se cambia por SQL). " : null}
              Cada cambio se confirma y queda registrado en la auditoría.
            </DialogDescription>
          </DialogHeader>
          {pendingChange ? (
            <div className="grid gap-4">
              <p className="text-base">
                ¿Seguro que quieres <strong>{pendingChange.grant ? "otorgar" : "quitar"}</strong> el rol{" "}
                <strong>{ROLE_LABELS[pendingChange.role]}</strong> {pendingChange.grant ? "a" : "de"} <strong className="break-all">{who}</strong>?
              </p>
              <p className="text-sm text-muted-foreground">{ROLE_HELP[pendingChange.role]}</p>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving} onClick={() => setPendingChange(null)}>
                  Volver
                </Button>
                <Button type="button" variant={pendingChange.grant ? "default" : "destructive"} loading={saving} onClick={confirm}>
                  {pendingChange.grant ? "Sí, otorgar" : "Sí, quitar"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <ul className="grid gap-2">
              {GRANTABLE_ROLES.map((role) => {
                const has = roles.includes(role);
                const id = `role-${userId}-${role}`;
                return (
                  <li key={role} className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
                    <div className="min-w-0 flex-1">
                      <label htmlFor={id} className="font-medium">
                        {ROLE_LABELS[role]}
                      </label>
                      <p className="text-sm text-muted-foreground">{ROLE_HELP[role]}</p>
                    </div>
                    <Switch id={id} checked={has} onCheckedChange={(checked) => setPendingChange({ role, grant: checked })} />
                  </li>
                );
              })}
              {roles.includes("superadmin") ? (
                <li className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                  <Badge variant="secondary">Superadmin</Badge> asignado por SQL
                </li>
              ) : null}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
