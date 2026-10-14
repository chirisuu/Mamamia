import { CheckCircle2, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { INTEGRATION_LABELS } from "../lib/labels";

export type IntegrationStatus = Record<keyof typeof INTEGRATION_LABELS, boolean>;

/** Estado real de cada integración (variables de entorno del servidor). Nunca muestra valores. */
export function IntegrationsCard({ status }: { status: IntegrationStatus }) {
  const entries = Object.entries(INTEGRATION_LABELS) as Array<[keyof typeof INTEGRATION_LABELS, (typeof INTEGRATION_LABELS)[keyof typeof INTEGRATION_LABELS]]>;
  const configured = entries.filter(([k]) => status[k]).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">Integraciones</CardTitle>
        <CardDescription>
          {configured} de {entries.length} configuradas. Lo pendiente no se simula: la función correspondiente avisa que falta configurarla.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {entries.map(([key, info]) => {
            const ok = status[key];
            const Icon = ok ? CheckCircle2 : CircleDashed;
            return (
              <li key={key} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                <Icon className={ok ? "size-5 shrink-0 text-success" : "size-5 shrink-0 text-muted-foreground"} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{info.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{info.hint}</p>
                </div>
                <Badge variant={ok ? "success" : "outline"}>{ok ? "Configurado" : "Pendiente"}</Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
