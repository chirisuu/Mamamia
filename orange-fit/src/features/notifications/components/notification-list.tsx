"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../actions";
import { relativeTime } from "../lib/time";
import type { NotificationItem } from "../server/ops";

type Props = {
  items: NotificationItem[];
  unreadCount: number;
  /** Instante de referencia del servidor (evita diferencias de hidratación). */
  nowIso: string;
  timeZone: string;
};

const isInternal = (url: string | null): url is string => Boolean(url && url.startsWith("/") && !url.startsWith("//"));

export function NotificationList({ items, unreadCount, nowIso, timeZone }: Props) {
  const router = useRouter();
  const [readIds, setReadIds] = React.useState<Set<string>>(() => new Set());
  const [allRead, setAllRead] = React.useState(false);
  const [pendingAll, startAll] = React.useTransition();
  const now = React.useMemo(() => new Date(nowIso), [nowIso]);

  const isUnread = (n: NotificationItem) => !n.readAt && !allRead && !readIds.has(n.id);
  const unread = allRead ? 0 : Math.max(0, unreadCount - items.filter((n) => !n.readAt && readIds.has(n.id)).length);

  async function open(n: NotificationItem) {
    if (isUnread(n)) {
      setReadIds((prev) => new Set(prev).add(n.id));
      const res = await markNotificationReadAction(n.id);
      if (!res.ok) {
        setReadIds((prev) => {
          const next = new Set(prev);
          next.delete(n.id);
          return next;
        });
        toast.error(res.error.message);
        return;
      }
    }
    if (isInternal(n.url) && n.url !== "/app/notificaciones") router.push(n.url);
    else router.refresh();
  }

  function markAll() {
    startAll(async () => {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      setAllRead(true);
      toast.success(res.data.count ? "Todo marcado como leído." : "No tenías notificaciones sin leer.");
      router.refresh();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No tienes notificaciones"
        description="Aquí verás tus recordatorios, logros y avisos de la app. Puedes activar recordatorios más abajo."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread ? `${unread} sin leer` : "Todo al día"}
        </p>
        <Button variant="ghost" size="sm" onClick={markAll} loading={pendingAll} disabled={unread === 0}>
          <CheckCheck aria-hidden="true" />
          Marcar todo como leído
        </Button>
      </div>
      <ul className="grid gap-1 rounded-2xl border border-border bg-card p-2 shadow-sm">
        {items.map((n) => {
          const fresh = isUnread(n);
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => void open(n)}
                className={cn(
                  "flex min-h-16 w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/50",
                  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
                    fresh ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Bell className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block leading-snug", fresh ? "font-semibold" : "font-medium")}>
                    {n.title}
                    {fresh ? <span className="sr-only"> (sin leer)</span> : null}
                  </span>
                  {n.body ? <span className="mt-0.5 block text-sm text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-1 block text-xs text-muted-foreground">{relativeTime(n.createdAt, now, timeZone)}</span>
                </span>
                {isInternal(n.url) && n.url !== "/app/notificaciones" ? (
                  <ChevronRight className="mt-2 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
