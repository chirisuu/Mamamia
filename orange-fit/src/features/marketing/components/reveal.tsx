"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

const VARIANTS = {
  // Ocultar es instantáneo y solo ocurre fuera de pantalla (ver abajo).
  hidden: { opacity: 0, y: 16, transition: { duration: 0 } },
  shown: (delay: number) => ({ opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const, delay } }),
};

/**
 * Entrada suave al hacer scroll, como mejora progresiva: el HTML del servidor llega VISIBLE (sin JS,
 * para buscadores y en la primera pintura todo se ve). Tras hidratar, solo los bloques que aún están
 * bajo el borde de la pantalla se ocultan y aparecen al entrar en vista. Con movimiento reducido no
 * se anima nada.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const ref = React.useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const [armed, setArmed] = React.useState(false);

  React.useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    // Solo se "arma" lo que todavía no se ve: así nada desaparece frente a la persona.
    if (el.getBoundingClientRect().top > window.innerHeight) setArmed(true);
  }, [reduce]);

  const Component = as === "li" ? motion.li : as === "section" ? motion.section : motion.div;
  return (
    <Component
      ref={ref as React.Ref<never>}
      className={className}
      initial={false}
      custom={delay}
      variants={VARIANTS}
      animate={!armed || inView ? "shown" : "hidden"}
    >
      {children}
    </Component>
  );
}
