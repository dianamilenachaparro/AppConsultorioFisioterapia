import * as React from "react";
import { cn } from "@/lib/utils";

/** `<select>` nativo con el estilo de los inputs: mejor experiencia en celular y funciona sin JS. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-10 w-full min-w-0 rounded-sm border border-input bg-card px-3.5 py-1 text-base outline-none transition-[border-color,box-shadow] duration-200 hover:border-primary/40 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
