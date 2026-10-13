import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Recommendation } from "../lib/recommendations";

/** Sugerencias por reglas sobre los registros del usuario, siempre etiquetadas como tales. */
export function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  if (!recommendations.length) return null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle as="h2">Sugerencias para ti</CardTitle>
        <CardDescription>Según tus registros. No reemplazan la opinión de un profesional de la salud.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-4">
          {recommendations.map((r) => (
            <li key={r.id} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
                <Lightbulb className="size-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium leading-snug">{r.title}</p>
                  <Badge variant="outline">Sugerencia</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                {r.links.length ? (
                  <ul className="mt-1 flex flex-col">
                    {r.links.map((l) => (
                      <li key={l.href}>
                        <Link
                          href={l.href}
                          className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
                        >
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
