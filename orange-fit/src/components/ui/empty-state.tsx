import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = Omit<React.ComponentProps<"div">, "title"> & {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Acción principal (normalmente un <Button>). Solo si de verdad funciona. */
  action?: React.ReactNode;
};

/** Estado vacío de una lista o sección: qué pasa y qué puede hacer la persona. */
function EmptyState({ icon: Icon, title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-10 text-center",
        className,
      )}
      {...props}
    >
      {Icon ? (
        <div className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary-strong">
          <Icon className="size-7" aria-hidden="true" />
        </div>
      ) : null}
      <p className="text-base font-semibold tracking-tight text-foreground">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{action}</div> : null}
    </div>
  );
}

export { EmptyState, type EmptyStateProps };
