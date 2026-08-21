import { parse } from "csv-parse/sync";
import type { NormalizedTender, TenderSource, TenderSourceResult } from "./types";
import { CkanClient } from "./ckan";

/**
 * Conector real: Nación — Procesos de Contratación de Obra Pública
 * (plataforma CONTRAT.AR), publicados como dataset abierto en datos.gob.ar
 * bajo el portal nacional de datos (CKAN).
 *
 * Dataset de referencia (confirmar slug exacto en producción, el portal es
 * una SPA y no pudimos leer el JSON de package_show desde el entorno de
 * investigación — devuelve 404 a fetchers sin JS):
 *   https://datos.gob.ar/dataset/jgm-procesos-contratacion-obra-publica-gestionados-plataforma-contratar
 *
 * CÓMO TERMINAR DE CONECTAR ESTA FUENTE:
 *   1. Confirmar el `datasetId` real (ver CONTRATAR_DATASET_ID abajo).
 *   2. Confirmar los nombres de columna del CSV publicado y ajustar
 *      `COLUMN_CANDIDATES` si hace falta (ya se cubren varios alias comunes).
 *   3. Correr `npm run ingest -- contratar-ckan` y revisar `ingest_runs`.
 *
 * El cliente CKAN (`ckan.ts`) es genérico: sirve para cualquier dataset de
 * datos.gob.ar, no solo este.
 */

const CKAN_BASE_URL = process.env.CONTRATAR_CKAN_BASE_URL ?? "https://datos.gob.ar";
const DATASET_ID =
  process.env.CONTRATAR_DATASET_ID ?? "jgm-procesos-contratacion-obra-publica-gestionados-plataforma-contratar";
const DEFAULT_JURISDICTION = "Nación";

// Varios alias posibles por columna — los datasets de datos.gob.ar suelen
// cambiar mayúsculas/tildes/guiones bajos entre versiones.
const COLUMN_CANDIDATES: Record<string, string[]> = {
  id: ["id_proceso", "id_contratacion", "nro_proceso", "expediente", "id"],
  title: ["objeto", "objeto_contratacion", "descripcion", "titulo"],
  organismo: ["organismo", "jurisdiccion_contratante", "reparticion", "comitente"],
  procedureType: ["tipo_procedimiento", "procedimiento", "modalidad"],
  status: ["estado", "situacion"],
  publishedAt: ["fecha_publicacion", "fecha_apertura", "fecha_inicio"],
  closingAt: ["fecha_cierre", "fecha_limite", "fecha_apertura"],
  amount: ["monto", "presupuesto_oficial", "monto_adjudicado"],
  url: ["url", "link", "enlace"],
};

function findColumn(headerRow: string[], field: keyof typeof COLUMN_CANDIDATES): string | undefined {
  const candidates = COLUMN_CANDIDATES[field] ?? [];
  const normalizedHeaders = headerRow.map((h) => h.trim().toLowerCase());
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(candidate);
    if (idx !== -1) return headerRow[idx];
  }
  return undefined;
}

function parseAmount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function parseDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function createContratarCkanSource(): TenderSource {
  return {
    key: "contratar-ckan",
    label: "Nación — CONTRAT.AR (obra pública, vía datos.gob.ar)",
    async fetchTenders(): Promise<TenderSourceResult> {
      const client = new CkanClient(CKAN_BASE_URL);
      const warnings: string[] = [];

      const pkg = await client.packageShow(DATASET_ID);
      const resource = client.findResourceByFormat(pkg, ["csv"]);

      if (!resource) {
        return {
          tenders: [],
          warnings: [`No se encontró un recurso CSV en el dataset "${DATASET_ID}".`],
        };
      }

      const csvText = await client.downloadResource(resource);
      const rows: Record<string, string>[] = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
      });

      if (rows.length === 0) {
        return { tenders: [], warnings: ["El CSV descargado no tiene filas."] };
      }

      const headerRow = Object.keys(rows[0]!);
      const col = {
        id: findColumn(headerRow, "id"),
        title: findColumn(headerRow, "title"),
        organismo: findColumn(headerRow, "organismo"),
        procedureType: findColumn(headerRow, "procedureType"),
        status: findColumn(headerRow, "status"),
        publishedAt: findColumn(headerRow, "publishedAt"),
        closingAt: findColumn(headerRow, "closingAt"),
        amount: findColumn(headerRow, "amount"),
        url: findColumn(headerRow, "url"),
      };

      if (!col.id || !col.title) {
        return {
          tenders: [],
          warnings: [
            `No se pudieron mapear columnas clave (id/título) en el CSV. Encabezados encontrados: ${headerRow.join(", ")}. Ajustá COLUMN_CANDIDATES en contratar-ckan.ts.`,
          ],
        };
      }

      const tenders: NormalizedTender[] = [];
      for (const row of rows) {
        const externalId = row[col.id]?.trim();
        const title = row[col.title]?.trim();
        if (!externalId || !title) continue;

        tenders.push({
          externalId,
          title,
          organismo: (col.organismo && row[col.organismo]?.trim()) || "Organismo no informado",
          jurisdiction: DEFAULT_JURISDICTION,
          procedureType: col.procedureType ? row[col.procedureType]?.trim() : undefined,
          status: "publicada",
          publishedAt: parseDate(col.publishedAt ? row[col.publishedAt] : undefined),
          closingAt: parseDate(col.closingAt ? row[col.closingAt] : undefined),
          amount: parseAmount(col.amount ? row[col.amount] : undefined),
          currency: "ARS",
          url: col.url ? row[col.url]?.trim() : undefined,
          raw: row,
        });
      }

      return { tenders, warnings };
    },
  };
}
