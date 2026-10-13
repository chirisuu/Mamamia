import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/**
 * Botón base. Todos los tamaños miden ≥ 44 px de alto (objetivo táctil).
 * El texto sobre naranja es carbón (primary-foreground) porque blanco no llega a AA.
 */
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold",
    "transition-[background-color,color,box-shadow,scale,opacity] duration-150 ease-out active:scale-[0.98]",
    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  ],
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline: "border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "text-primary-strong underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-11 px-4 text-sm",
        default: "h-12 px-5 text-base",
        lg: "h-14 px-7 text-base",
        icon: "size-12",
        "icon-sm": "size-11",
      },
    },
    compoundVariants: [
      // El enlace no lleva caja: conserva alto táctil pero sin relleno lateral.
      { variant: "link", class: "px-0 active:scale-100" },
    ],
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renderiza el hijo (p. ej. <Link>) con los estilos del botón. */
    asChild?: boolean;
    /** Muestra un spinner, deshabilita el botón y marca aria-busy. */
    loading?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const isDisabled = Boolean(disabled || loading);

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? "" : undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      // Un <a> no admite disabled: se usa aria-disabled (y pointer-events-none por estilo).
      disabled={asChild ? undefined : isDisabled}
      aria-disabled={asChild && isDisabled ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner aria-hidden="true" className="size-5" /> : null}
      <Slot.Slottable>{children}</Slot.Slottable>
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
