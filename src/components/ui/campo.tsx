import type * as React from "react";
import { Label } from "@/components/ui/label";

/** Etiqueta + control + mensaje de error, para formularios. */
export function Campo({
  id,
  etiqueta,
  error,
  children,
  className,
}: {
  id: string;
  etiqueta: string;
  error?: string[];
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error?.[0] && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}
