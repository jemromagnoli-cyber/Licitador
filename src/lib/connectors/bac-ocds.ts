import type { TenderSource, TenderSourceResult } from "./types";
import { normalizeOcdsReleasePackage, type OcdsReleasePackage } from "./ocds";

/**
 * Conector real: Buenos Aires Compras (BAC) — CABA.
 *
 * BAC publica sus datos de compras y contrataciones bajo el estándar Open
 * Contracting (OCDS) en el portal de datos abiertos de la Ciudad. Confirmado
 * explorando https://data.buenosaires.gob.ar/dataset/buenos-aires-compras:
 * el recurso "Buenos Aires Compras" (formato JSON) es el release/record
 * package OCDS. Es un volcado del historial completo (desde marzo 2011) que
 * el portal actualiza cada 15 días — no es un feed incremental por fecha.
 *
 * Referencia técnica publicada por el propio GCBA:
 * https://github.com/datosgcba/BAC_OCDS
 *
 * OJO — riesgo conocido y no verificado todavía en producción: al ser un
 * volcado histórico completo, el JSON puede ser pesado. Este conector hace
 * `fetch` + `res.json()` (carga todo en memoria). Si en producción esto
 * falla por timeout o memoria, el próximo paso es reescribirlo con parseo
 * en streaming (ej. paquete `stream-json`) en lugar de `res.json()`, o
 * evaluar si el portal ofrece algún recurso más acotado (hay variantes
 * "Anual" en CSV que podrían ser más chicas). No se pudo probar el fetch
 * real desde el entorno de desarrollo (red restringida) — se probó por
 * primera vez desde Railway.
 *
 * La URL de abajo es la del recurso real. Queda igual overrideable por
 * variable de entorno BAC_OCDS_URL por si el id del recurso cambia en el
 * portal (los ids de recurso de CKAN son estables, pero por las dudas).
 */

const DEFAULT_JURISDICTION = "CABA";

const DEFAULT_BAC_OCDS_URL =
  "https://data.buenosaires.gob.ar/dataset/buenos-aires-compras/resource/2a3d077c-71b6-4ba7-8924-f3e38cf1b8fc/download";

export function createBacOcdsSource(): TenderSource {
  return {
    key: "bac-ocds",
    label: "Buenos Aires Compras (BAC) — OCDS",
    async fetchTenders(): Promise<TenderSourceResult> {
      const url = process.env.BAC_OCDS_URL || DEFAULT_BAC_OCDS_URL;

      let res: Response;
      try {
        res = await fetch(url, {
          headers: { Accept: "application/json" },
          // Es un volcado histórico completo, no una respuesta liviana —
          // damos bastante margen antes de dar por perdido el intento.
          signal: AbortSignal.timeout(180_000),
        });
      } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw new Error(
          `No se pudo descargar el JSON de BAC (${url}): ${cause}. Si es un timeout, el archivo ` +
            "puede ser demasiado grande para bajarlo entero — considerar reescribir con streaming.",
        );
      }

      if (!res.ok) {
        throw new Error(`BAC OCDS respondió ${res.status} ${res.statusText}`);
      }

      let pkg: OcdsReleasePackage;
      try {
        pkg = (await res.json()) as OcdsReleasePackage;
      } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw new Error(
          `La respuesta de BAC no se pudo parsear como JSON (${cause}). Puede ser un corte a mitad ` +
            "de la descarga por el tamaño del archivo.",
        );
      }

      const { tenders, warnings } = normalizeOcdsReleasePackage(pkg, DEFAULT_JURISDICTION);
      return { tenders, warnings };
    },
  };
}
