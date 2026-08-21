import type { TenderSource, TenderSourceResult } from "./types";
import { normalizeOcdsReleasePackage, type OcdsReleasePackage } from "./ocds";

/**
 * Conector real: Buenos Aires Compras (BAC) — CABA.
 *
 * BAC publica sus datos de contrataciones bajo el estándar Open Contracting
 * (OCDS) en data.buenosaires.gob.ar. Al momento de escribir este conector no
 * pudimos confirmar la URL exacta del endpoint (el explorador de datos
 * abiertos de la Ciudad requiere JavaScript y no fue accesible desde el
 * entorno de investigación), así que dejamos el endpoint configurable por
 * variable de entorno.
 *
 * CÓMO TERMINAR DE CONECTAR ESTA FUENTE:
 *   1. Entrar a https://data.buenosaires.gob.ar/dataset/buenos-aires-compras
 *      y ubicar el recurso que expone el release package OCDS (JSON).
 *   2. Setear BAC_OCDS_URL con esa URL en .env / variables de Railway.
 *   3. Correr `npm run ingest -- bac-ocds` y revisar la tabla ingest_runs.
 *
 * El parser (`ocds.ts`) ya está listo y probado contra el estándar OCDS —
 * lo único que falta confirmar es la URL del recurso en producción.
 */

const DEFAULT_JURISDICTION = "CABA";

export function createBacOcdsSource(): TenderSource {
  return {
    key: "bac-ocds",
    label: "Buenos Aires Compras (BAC) — OCDS",
    async fetchTenders(): Promise<TenderSourceResult> {
      const url = process.env.BAC_OCDS_URL;

      if (!url) {
        return {
          tenders: [],
          warnings: [
            "BAC_OCDS_URL no está configurada. Ver comentario en bac-ocds.ts para completar la conexión.",
          ],
        };
      }

      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        // Los release packages OCDS pueden ser grandes; damos margen generoso.
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        throw new Error(`BAC OCDS respondió ${res.status} ${res.statusText}`);
      }

      const pkg = (await res.json()) as OcdsReleasePackage;
      const { tenders, warnings } = normalizeOcdsReleasePackage(pkg, DEFAULT_JURISDICTION);
      return { tenders, warnings };
    },
  };
}
