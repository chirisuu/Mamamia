"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

type RingState = {
  /** Sin meta válida (null o ≤ 0): no se calcula restante. */
  hasGoal: boolean;
  consumed: number;
  goal: number;
  remaining: number;
  over: boolean;
  overAmount: number;
  /** Fracción del anillo principal (0–1). */
  fraction: number;
  /** Fracción de la vuelta extra cuando se supera la meta (0–1). */
  overFraction: number;
};

/** Cálculo puro del anillo; exportado para pruebas y para quien necesite los mismos números. */
function getRingState(consumed: number, goal: number | null | undefined): RingState {
  const safeConsumed = Number.isFinite(consumed) ? Math.max(0, consumed) : 0;
  const hasGoal = goal != null && Number.isFinite(goal) && goal > 0;
  if (!hasGoal) {
    return { hasGoal: false, consumed: safeConsumed, goal: 0, remaining: 0, over: false, overAmount: 0, fraction: 0, overFraction: 0 };
  }
  const g = goal as number;
  const over = safeConsumed > g;
  const overAmount = over ? safeConsumed - g : 0;
  return {
    hasGoal: true,
    consumed: safeConsumed,
    goal: g,
    remaining: over ? 0 : g - safeConsumed,
    over,
    overAmount,
    fraction: Math.min(safeConsumed / g, 1),
    overFraction: over ? Math.min(overAmount / g, 1) : 0,
  };
}

type ProgressRingProps = Omit<React.ComponentProps<"div">, "children"> & {
  consumed: number;
  goal: number | null | undefined;
  unit?: string;
  /** Nombre accesible del bloque. */
  label?: string;
  /** Diámetro en px. */
  size?: number;
  strokeWidth?: number;
  /** Contenido extra bajo los números (p. ej. desglose base/ejercicio). */
  footer?: React.ReactNode;
};

/**
 * Anillo calórico del día: muestra restante (grande), consumido y meta.
 * Si se supera la meta, el anillo queda completo y una segunda vuelta fina en tono neutro
 * indica cuánto: sin rojo ni mensajes de culpa (regla de producto: no castigar por comer).
 * La animación dura 250 ms y desaparece con prefers-reduced-motion.
 */
function ProgressRing({
  consumed,
  goal,
  unit = "kcal",
  label = "Calorías de hoy",
  size = 224,
  strokeWidth = 18,
  footer,
  className,
  style,
  ...props
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const state = getRingState(consumed, goal);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const };
  const overStroke = Math.max(4, Math.round(strokeWidth * 0.4));

  const status = !state.hasGoal ? "no-goal" : state.over ? "over" : "under";

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="progress-ring"
      data-state={status}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size, ...style }}
      {...props}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={strokeWidth} className="stroke-muted" />
        {state.fraction > 0 ? (
          <motion.circle
            data-ring="progress"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            className="stroke-primary"
            initial={reduceMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - state.fraction) }}
            transition={transition}
          />
        ) : null}
        {state.overFraction > 0 ? (
          <motion.circle
            data-ring="over"
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={overStroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            className="stroke-foreground/75"
            initial={reduceMotion ? false : { strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - state.overFraction) }}
            transition={reduceMotion ? transition : { ...transition, delay: 0.15 }}
          />
        ) : null}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center" data-numeric="">
        {!state.hasGoal ? (
          <>
            <span className="text-4xl font-semibold tracking-tight text-foreground">{formatNumber(state.consumed)}</span>
            <span className="text-sm text-muted-foreground">{unit} consumidas</span>
            <span className="mt-1 text-xs text-muted-foreground">Meta pendiente de definir</span>
          </>
        ) : state.over ? (
          <>
            <span className="text-4xl font-semibold tracking-tight text-foreground">{formatNumber(state.overAmount)}</span>
            <span className="text-sm text-muted-foreground">{unit} sobre tu meta</span>
            <span className="mt-1 text-xs text-muted-foreground">
              {formatNumber(state.consumed)} de {formatNumber(state.goal)} {unit}
            </span>
          </>
        ) : (
          <>
            <span className="text-4xl font-semibold tracking-tight text-foreground">{formatNumber(state.remaining)}</span>
            <span className="text-sm text-muted-foreground">{unit} restantes</span>
            <span className="mt-1 text-xs text-muted-foreground">
              {formatNumber(state.consumed)} de {formatNumber(state.goal)} {unit}
            </span>
          </>
        )}
        {footer ? <div className="mt-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export { ProgressRing, getRingState, type ProgressRingProps, type RingState };
