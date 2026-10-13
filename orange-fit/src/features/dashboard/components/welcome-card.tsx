import Link from "next/link";
import { Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Primer uso: explica en una línea qué hacer y da la acción real. */
export function WelcomeCard({ name, defaultMeal }: { name: string | null; defaultMeal: string }) {
  return (
    <section
      aria-labelledby="bienvenida"
      className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-accent p-5 text-accent-foreground"
    >
      <div className="flex items-center gap-2 text-primary-strong">
        <Sparkles className="size-5" aria-hidden="true" />
        <h2 id="bienvenida" className="text-base font-semibold text-foreground">
          {name ? `¡Hola, ${name}! Empecemos` : "¡Empecemos!"}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Empieza registrando lo que comiste hoy. Con unos días de registros verás tu semana, tus rachas y sugerencias hechas para ti.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/app/agregar/buscar?comida=${defaultMeal}`}>
            <Search aria-hidden="true" />
            Registrar mi primera comida
          </Link>
        </Button>
      </div>
    </section>
  );
}
