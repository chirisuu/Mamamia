import * as React from "react";
import { cn } from "@/lib/utils";

/** Campo de texto. 16 px de fuente para que iOS no haga zoom; 48 px de alto. */
const inputBase = [
  "w-full min-w-0 rounded-xl border border-input bg-card text-base text-foreground shadow-xs",
  "transition-[border-color,box-shadow] duration-150 outline-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring",
  "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive",
  "disabled:cursor-not-allowed disabled:opacity-50",
];

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputBase,
        "flex h-12 px-4",
        "file:mr-3 file:inline-flex file:h-8 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input, inputBase };
