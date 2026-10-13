import * as React from "react";
import { cn } from "@/lib/utils";
import { inputBase } from "@/components/ui/input";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputBase, "field-sizing-content flex min-h-28 px-4 py-3 leading-relaxed", className)}
      {...props}
    />
  );
}

export { Textarea };
