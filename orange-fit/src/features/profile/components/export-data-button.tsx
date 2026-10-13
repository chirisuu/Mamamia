"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";

function filenameFrom(header: string | null): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  return match?.[1] ?? "orange-fit-mis-datos.json";
}

/**
 * Descarga el JSON de /api/account/export. Se hace con fetch (y no con un enlace directo) para
 * mostrar el error real si falla (límite de descargas, servidor caído) en vez de bajar un archivo de error.
 */
export function ExportDataButton({ variant = "outline", className }: Pick<ButtonProps, "variant" | "className">) {
  const [pending, setPending] = React.useState(false);

  async function download() {
    setPending(true);
    try {
      const res = await fetch("/api/account/export", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        toast.error(body?.error?.message ?? "No pudimos preparar tu descarga.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(res.headers.get("content-disposition"));
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Listo: revisa tus descargas. Los enlaces a fotos vencen en 1 hora.");
    } catch {
      toast.error("No pudimos conectar con el servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant={variant} className={className} onClick={download} loading={pending}>
      {pending ? null : <Download aria-hidden="true" />}
      Descargar mis datos
    </Button>
  );
}
