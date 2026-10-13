import {
  Activity,
  Bell,
  CalendarDays,
  Camera,
  ChefHat,
  Droplet,
  Mic,
  ScanBarcode,
  Search,
  ShoppingCart,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
  Type,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeatureIcon, MarketingFeature, PlanBadge } from "../content";

const ICONS: Record<FeatureIcon, LucideIcon> = {
  search: Search,
  camera: Camera,
  mic: Mic,
  type: Type,
  barcode: ScanBarcode,
  calendar: CalendarDays,
  chef: ChefHat,
  cart: ShoppingCart,
  trending: TrendingUp,
  timer: Timer,
  droplet: Droplet,
  sparkles: Sparkles,
  activity: Activity,
  trophy: Trophy,
  bell: Bell,
};

export function FeatureGlyph({ icon, className }: { icon: FeatureIcon; className?: string }) {
  const Icon = ICONS[icon];
  return (
    <span
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary-strong", className)}
      aria-hidden="true"
    >
      <Icon className="size-5" />
    </span>
  );
}

export function PlanBadgeTag({ badge }: { badge: PlanBadge }) {
  if (badge === "premium") return <Badge>Premium</Badge>;
  if (badge === "free") return <Badge variant="secondary">Gratis</Badge>;
  return null;
}

/** Tarjeta de una función: icono, nombre, qué hace y en qué plan está (si se sabe). */
export function FeatureCard({
  feature,
  badge,
  headingLevel = 3,
  className,
}: {
  feature: MarketingFeature;
  badge: PlanBadge;
  headingLevel?: 2 | 3 | 4;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <article className={cn("flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-3">
        <FeatureGlyph icon={feature.icon} />
        <PlanBadgeTag badge={badge} />
      </div>
      <Heading className="text-base font-semibold leading-snug">{feature.title}</Heading>
      <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
    </article>
  );
}
