import "server-only";
import { google } from "googleapis";
import { clienteOAuth } from "./oauth";

export type Celda = string | number;
export type Rango = { rango: string; valores: Celda[][] };

/** Lo único que la exportación necesita de Google Sheets; se puede inyectar un falso en pruebas. */
export interface ClienteSheets {
  crearHoja(titulo: string): Promise<{ id: string; url: string }>;
  escribirValores(id: string, rangos: Rango[]): Promise<void>;
}

export type FabricaClienteSheets = (refreshToken: string) => ClienteSheets;

/** Implementación real sobre `googleapis` con el refresh token del Dueño. */
export const clienteSheetsGoogle: FabricaClienteSheets = (refreshToken) => {
  const auth = clienteOAuth();
  auth.setCredentials({ refresh_token: refreshToken });
  const sheets = google.sheets({ version: "v4", auth });
  return {
    async crearHoja(titulo) {
      const r = await sheets.spreadsheets.create({ requestBody: { properties: { title: titulo, locale: "es_CO" } } });
      return { id: r.data.spreadsheetId!, url: r.data.spreadsheetUrl! };
    },
    async escribirValores(id, rangos) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: id,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data: rangos.map((r) => ({ range: r.rango, values: r.valores })),
        },
      });
    },
  };
};
