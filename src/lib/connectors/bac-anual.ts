import { parse } from "csv-parse/sync";
import type { NormalizedTender, TenderSource, TenderSourceResult, TenderStatus } from "./types";

/**
 * Conector real: Buenos Aires Compras (BAC) — CABA, SOLO año en curso.
 *
 * Reemplaza al intento anterior (bac-ocds.ts) de usar el volcado histórico
 * completo desde 2011: ese archivo trae 15 años de procesos, la mayoría ya
 * cerrados, y probado en producción tardaba varios minutos en descargarse y
 * procesarse — impracticable para una fuente que se quiere correr seguido,
 * y además mezclaba historial viejo con lo vigente, que es lo único que le
 * interesa a una empresa evaluando en qué presentarse.
 *
 * Este conector usa en cambio el recurso "Buenos Aires Compras - Anual"
 * del mismo dataset, que el propio portal documenta como acotado al año en
 * curso ("Detalle de los procesos de compras gestionados a través del
 * sistema Buenos Aires Compras durante el año corriente"):
 * https://data.buenosaires.gob.ar/dataset/buenos-aires-compras/resource/24ba48bb-7c3c-4a75-9047-1e03f0b53a6e
 *
 * Combinado con el filtro de relevancia (src/lib/tenders/relevance.ts,
 * que descarta estados terminales y fechas de cierre pasadas), el
 * resultado neto es: solo procesos de este año que además siguen abiertos.
 *
 * IMPORTANTE — aunque el portal lo etiqueta como CSV, probado en producción
 * resultó ser un export de OCDS "aplanado" (flattened OCDS): cada fila es
 * un proceso, y las columnas son los mismos campos que usa el estándar
 * OCDS pero con rutas tipo "tender/title", "tender/status",
 * "tender/procuringEntity/name" en vez de JSON anidado. Los nombres de
 * columna de abajo están confirmados contra un resultado real de
 * producción (ver ingest_runs), no son una estimación.
 */

const CSV_URL =
  process.env.BAC_ANUAL_CSV_URL ??
  "https://data.buenosaires.gob.ar/dataset/buenos-aires-compras/resource/24ba48bb-7c3c-4a75-9047-1e03f0b53a6e/download";

const DEFAULT_JURISDICTION = "CABA";

// Primero los nombres reales confirmados (flattened OCDS, separador "/"),
// después algunos alias en español por si el portal cambia el formato de
// exportación más adelante.
const COLUMN_CANDIDATES: Record<string, string[]> = {
  id: ["tender/id", "ocid", "numero_proceso", "nro_proceso", "expediente", "id"],
  title: ["tender/title", "objeto", "objeto_de_la_contratacion", "descripcion"],
  organismo: ["tender/procuringEntity/name", "parties/0/name", "reparticion", "organismo"],
  procedureType: ["tender/procurementMethodDetails", "tender/procurementMethod", "tipo_de_procedimiento"],
  category: ["tender/mainProcurementCategory", "rubro", "categoria"],
  status: ["tender/status", "estado", "estado_del_proceso"],
  publishedAt: ["date", "tender/tenderPeriod/startDate", "fecha_de_publicacion"],
  closingAt: ["tender/tenderPeriod/endDate", "fecha_de_apertura", "fecha_de_cierre"],
  amount: ["tender/value/amount", "presupuesto_oficial", "monto"],
  currency: ["tender/value/currency", "moneda"],
  url: ["tender/documents/0/url", "url", "link"],
};

// Igual que en ocds.ts — mismo estándar OCDS, mismos valores de status en
// inglés. Confirmado contra un resultado real de producción.
const STATUS_MAP: Record<string, TenderStatus> = {
  planning: "publicada",
  planned: "publicada",
  active: "abierta",
  cancelled: "cancelada",
  unsuccessful: "desierta",
  complete: "cerrada",
  withdrawn: "cancelada",
};

function findColumn(headerRow: string[], field: keyof typeof COLUMN_CANDIDATES): string | undefined {
  const candidates = COLUMN_CANDIDATES[field] ?? [];
  // Normaliza sacando tildes/diacríticos y todo lo que no sea alfanumérico
  // o "/" — así "Número de Proceso" matchea "numero_de_proceso" Y
  // preservamos el separador de rutas OCDS aplanadas ("tender/title").
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9/]/g, "");
  const normalizedHeaders = headerRow.map(normalize);
  for (const candidate of candidates) {
    const idx = normalizedHeaders.indexOf(normalize(candidate));
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

function mapStatus(raw: string | undefined): TenderStatus {
  if (!raw) return "publicada";
  const key = raw.trim().toLowerCase();
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  // Fallback por si en algún momento el export trae texto en español en
  // vez de los valores OCDS en inglés.
  const s = key.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (s.includes("adjudic")) return "adjudicada";
  if (s.includes("desiert") || s.includes("fracas")) return "desierta";
  if (s.includes("cancel") || s.includes("anulad")) return "cancelada";
  if (s.includes("cerrad") || s.includes("finaliz") || s.includes("complet")) return "cerrada";
  if (s.includes("consulta")) return "en_consulta";
  if (s.includes("abiert") || s.includes("activ") || s.includes("convocat")) return "abierta";
  return "publicada";
}

export function createBacAnualSource(): TenderSource {
  return {
    key: "bac-anual",
    label: "Buenos Aires Compras (BAC) — año en curso",
    async fetchTenders(): Promise<TenderSourceResult> {
      const warnings: string[] = [];

      let res: Response;
      try {
        res = await fetch(CSV_URL, {
          headers: { Accept: "text/csv" },
          signal: AbortSignal.timeout(180_000),
        });
      } catch (err) {
        const cause = err instanceof Error ? err.message : String(err);
        throw new Error(`No se pudo descargar el CSV de BAC (${CSV_URL}): ${cause}`);
      }

      if (!res.ok) {
        throw new Error(`BAC (CSV anual) respondió ${res.status} ${res.statusText}`);
      }

      const csvText = await res.text();
      const rows: Record<string, string>[] = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
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
        category: findColumn(headerRow, "category"),
        status: findColumn(headerRow, "status"),
        publishedAt: findColumn(headerRow, "publishedAt"),
        closingAt: findColumn(headerRow, "closingAt"),
        amount: findColumn(headerRow, "amount"),
        currency: findColumn(headerRow, "currency"),
        url: findColumn(headerRow, "url"),
      };

      if (!col.id || !col.title) {
        return {
          tenders: [],
          warnings: [
            `No se pudieron mapear columnas clave (id/título) en el CSV de BAC. Encabezados encontrados: ${headerRow.join(", ")}. Ajustar COLUMN_CANDIDATES en bac-anual.ts.`,
          ],
        };
      }

      const unmappedStatuses = new Set<string>();
      const tenders: NormalizedTender[] = [];

      for (const row of rows) {
        const externalId = row[col.id]?.trim();
        const title = row[col.title]?.trim();
        if (!externalId || !title) continue;

        const rawStatus = col.status ? row[col.status]?.trim() : undefined;
        const status = mapStatus(rawStatus);
        if (rawStatus && status === "publicada" && !STATUS_MAP[rawStatus.toLowerCase()]) {
          unmappedStatuses.add(rawStatus);
        }

        tenders.push({
          externalId,
          title,
          organismo: (col.organismo && row[col.organismo]?.trim()) || "Organismo no informado",
          jurisdiction: DEFAULT_JURISDICTION,
          category: col.category ? row[col.category]?.trim() : undefined,
          procedureType: col.procedureType ? row[col.procedureType]?.trim() : undefined,
          status,
          publishedAt: parseDate(col.publishedAt ? row[col.publishedAt] : undefined),
          closingAt: parseDate(col.closingAt ? row[col.closingAt] : undefined),
          amount: parseAmount(col.amount ? row[col.amount] : undefined),
          currency: (col.currency && row[col.currency]?.trim()) || "ARS",
          url: col.url ? row[col.url]?.trim() : undefined,
          raw: row,
        });
      }

      if (unmappedStatuses.size > 0) {
        warnings.push(
          `Estados sin mapear claro (quedaron como "publicada"), ver STATUS_MAP en bac-anual.ts: ${Array.from(unmappedStatuses).slice(0, 10).join(" | ")}`,
        );
      }

      return { tenders, warnings };
    },
  };
}
