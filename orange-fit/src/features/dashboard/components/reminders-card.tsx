import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardData } from "../queries";

const rowClass = cn(
  "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-accent/50",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

/** Notificaciones sin leer + recordatorios calculados con la hora local. Se oculta si no hay nada. */
export function RemindersCard({ reminders, notifications }: Pick<DashboardData, "reminders" | "notifications">) {
  const unread = notifications?.items ?? [];
  if (!reminders.length && !unread.length) return null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle as="h2">Recordatorios</CardTitle>
        {notifications && notifications.unreadCount > 0 ? (
          <CardAction>
            <Link
              href="/app/notificaciones"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-strong underline-offset-4 hover:underline"
            >
              Ver todas ({notifications.unreadCount})
            </Link>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="px-2">
        <ul className="grid gap-1">
          {unread.map((n) => (
            <li key={n.id}>
              <Link href={n.url?.startsWith("/") ? n.url : "/app/notificaciones"} className={rowClass}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary-strong">
                  <Bell className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-snug">{n.title}</span>
                  {n.body ? <span className="line-clamp-2 text-sm text-muted-foreground">{n.body}</span> : null}
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
          {reminders.map((r) => (
            <li key={r.id}>
              <Link href={r.href} className={rowClass}>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium leading-snug">{r.title}</span>
                  <span className="block text-sm text-muted-foreground">{r.body}</span>
                  <span className="mt-1 block text-sm font-semibold text-primary-strong">{r.actionLabel}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
