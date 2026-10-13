"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, ImageOff, Images, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { diffDays } from "@/lib/dates";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { PHOTO_POSE_LABELS, PHOTO_POSES, type PhotoPose } from "../lib/photo-path";
import { deletePhotoAction } from "../photo-actions";
import type { ProgressPhoto } from "../server/photos";

function PhotoImage({ photo, className }: { photo: ProgressPhoto; className?: string }) {
  const [failed, setFailed] = React.useState(false);
  if (!photo.url || failed) {
    return (
      <div className={`flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-muted p-3 text-center text-xs text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="size-5" aria-hidden="true" />
        No se pudo cargar la foto. Recarga la página.
      </div>
    );
  }
  return (
    // URL firmada temporal de un bucket privado: no pasa por el optimizador de imágenes (no se cachea).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photo.url}
      alt={`Foto de progreso, ${PHOTO_POSE_LABELS[photo.pose].toLowerCase()}, ${formatLongDate(photo.localDate)}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`aspect-[3/4] w-full object-cover ${className ?? ""}`}
    />
  );
}

/** Comparar dos fechas lado a lado (misma pose). */
function Compare({ photos }: { photos: ProgressPhoto[] }) {
  const poses = PHOTO_POSES.filter((p) => photos.some((ph) => ph.pose === p));
  const [chosenPose, setPose] = React.useState<PhotoPose>(poses[0] ?? "front");
  const pose = poses.includes(chosenPose) ? chosenPose : (poses[0] ?? "front");
  const forPose = photos.filter((p) => p.pose === pose);
  const dates = [...new Set(forPose.map((p) => p.localDate))].sort();
  const [before, setBefore] = React.useState<string | null>(null);
  const [after, setAfter] = React.useState<string | null>(null);
  const id = React.useId();

  const a = before && dates.includes(before) ? before : (dates[0] ?? null);
  const b = after && dates.includes(after) ? after : (dates.at(-1) ?? null);
  const photoA = forPose.find((p) => p.localDate === a) ?? null;
  const photoB = forPose.find((p) => p.localDate === b) ?? null;

  if (dates.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Para comparar necesitas fotos de la misma pose en al menos dos fechas distintas.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-pose`}>Pose</Label>
          <Select value={pose} onValueChange={(v) => setPose(v as PhotoPose)}>
            <SelectTrigger id={`${id}-pose`} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {poses.map((p) => (
                <SelectItem key={p} value={p}>
                  {PHOTO_POSE_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-a`}>Antes</Label>
          <Select value={a ?? undefined} onValueChange={setBefore}>
            <SelectTrigger id={`${id}-a`} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dates.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatShortDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-b`}>Después</Label>
          <Select value={b ?? undefined} onValueChange={setAfter}>
            <SelectTrigger id={`${id}-b`} size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dates.map((d) => (
                <SelectItem key={d} value={d}>
                  {formatShortDate(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Antes", date: a, photo: photoA },
          { label: "Después", date: b, photo: photoB },
        ].map((side) => (
          <figure key={side.label} className="grid gap-1.5 overflow-hidden">
            <div className="overflow-hidden rounded-2xl border border-border">{side.photo ? <PhotoImage photo={side.photo} /> : null}</div>
            <figcaption className="text-center text-sm">
              <span className="font-medium">{side.label}</span>
              <span className="block text-xs text-muted-foreground">{side.date ? formatShortDate(side.date) : "—"}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {a && b && a !== b ? (
        <p className="text-center text-sm text-muted-foreground" aria-live="polite">
          {Math.abs(diffDays(a, b))} días entre ambas fotos. Los cambios del cuerpo son lentos: compara con calma y con cariño.
        </p>
      ) : null}
    </div>
  );
}

export function PhotoGallery({ photos }: { photos: ProgressPhoto[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState<ProgressPhoto | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const [deleting, startDelete] = React.useTransition();

  const byDate = React.useMemo(() => {
    const map = new Map<string, ProgressPhoto[]>();
    for (const p of photos) map.set(p.localDate, [...(map.get(p.localDate) ?? []), p]);
    return [...map.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  }, [photos]);

  function remove() {
    if (!open) return;
    const target = open;
    startDelete(async () => {
      const res = await deletePhotoAction(target.id);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      toast.success("Foto borrada.");
      setConfirming(false);
      setOpen(null);
      router.refresh();
    });
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={Images}
        title="Aún no tienes fotos"
        description="Tu primera foto sirve de punto de partida. Con otra en unas semanas podrás compararlas lado a lado."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <section aria-labelledby="comparar-fotos" className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 id="comparar-fotos" className="flex items-center gap-2 text-base font-semibold">
          <ArrowLeftRight className="size-5 text-primary-strong" aria-hidden="true" />
          Comparar dos fechas
        </h2>
        <Compare photos={photos} />
      </section>

      <section aria-labelledby="todas-fotos" className="grid gap-4">
        <h2 id="todas-fotos" className="text-base font-semibold">
          Tus fotos ({photos.length})
        </h2>
        {byDate.map(([date, list]) => (
          <div key={date} className="grid gap-2">
            <h3 className="text-sm font-medium text-muted-foreground">{formatLongDate(date)}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(p)}
                    className="block w-full overflow-hidden rounded-xl border border-border outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    aria-label={`Ver foto ${PHOTO_POSE_LABELS[p.pose].toLowerCase()} del ${formatShortDate(p.localDate)}`}
                  >
                    <PhotoImage photo={p} />
                  </button>
                  <p className="mt-1 text-center text-xs text-muted-foreground">{PHOTO_POSE_LABELS[p.pose]}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <Dialog
        open={open !== null}
        onOpenChange={(v) => {
          if (!v) {
            setOpen(null);
            setConfirming(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open ? `${PHOTO_POSE_LABELS[open.pose]} · ${formatShortDate(open.localDate)}` : "Foto"}
            </DialogTitle>
            <DialogDescription>{open?.note ? open.note : "Solo tú puedes ver esta foto."}</DialogDescription>
          </DialogHeader>
          {open ? (
            <div className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-border">
              <PhotoImage photo={open} />
            </div>
          ) : null}
          <DialogFooter>
            {confirming ? (
              <>
                <p className="text-sm text-muted-foreground sm:mr-auto">Se borra la foto y su archivo. No se puede deshacer.</p>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={deleting}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={remove} loading={deleting}>
                  Sí, borrar
                </Button>
              </>
            ) : (
              <>
                <DialogClose asChild>
                  <Button variant="outline">Cerrar</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => setConfirming(true)}>
                  <Trash2 aria-hidden="true" />
                  Borrar foto
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
