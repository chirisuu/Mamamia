import Link from "next/link";
import { CircleCheck, X } from "lucide-react";

/**
 * Confirmación discreta tras eliminar la cuenta (`/?cuenta=eliminada`). Cerrar es un enlace a "/":
 * funciona sin JavaScript y limpia el parámetro de la URL.
 */
export function AccountDeletedNotice() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <div role="status" className="flex items-start gap-3 rounded-2xl border border-success/40 bg-card px-4 py-3 text-sm shadow-sm">
        <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
        <p className="flex-1 leading-relaxed">
          <strong className="font-semibold">Tu cuenta fue eliminada.</strong> Borramos tus datos y tus archivos. Gracias por
          haberla usado; si algún día quieres volver, aquí estaremos.
        </p>
        <Link
          href="/"
          scroll={false}
          aria-label="Cerrar aviso"
          className="-my-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
