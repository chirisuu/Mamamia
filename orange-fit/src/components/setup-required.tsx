/** Pantalla honesta cuando falta configurar Supabase: no simula sesión ni datos. */
export function SetupRequired({ appName }: { appName: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-3 px-6 py-16">
      <p className="text-sm font-medium text-primary-strong">{appName}</p>
      <h1 className="text-2xl font-semibold tracking-tight">Falta configurar la base de datos</h1>
      <p className="text-muted-foreground">
        Esta instalación no tiene definidas <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
        <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Sin ellas no hay cuentas ni datos que mostrar.
      </p>
      <p className="text-sm text-muted-foreground">Sigue la guía en <code>docs/DEPLOYMENT.md</code>.</p>
    </main>
  );
}
