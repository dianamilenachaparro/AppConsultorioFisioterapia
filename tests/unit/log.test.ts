import { afterEach, describe, expect, it, vi } from "vitest";
import { registrarError } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

describe("registrarError (Ley 1581)", () => {
  it("no registra el mensaje del error, que puede traer datos personales", () => {
    const espia = vi.spyOn(console, "error").mockImplementation(() => {});
    const e = Object.assign(new Error("Paciente Juan Pérez, documento 1010101010, dolor 8"), { code: "P2002" });
    registrarError("prueba", e);
    const salida = espia.mock.calls.flat().join(" ");
    expect(salida).toContain("[prueba]");
    expect(salida).toContain("P2002");
    expect(salida).toContain("at ");
    expect(salida).not.toMatch(/Juan|1010101010|dolor/);
  });
});
