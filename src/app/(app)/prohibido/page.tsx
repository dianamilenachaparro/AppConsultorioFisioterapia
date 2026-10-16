import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Prohibido() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">No tienes permiso para ver esta sección</h1>
      <p className="text-sm text-muted-foreground">
        Si crees que deberías tener acceso, habla con el Dueño del consultorio.
      </p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
