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
 * OJO — el archivo sigue siendo CSV y no pudimos inspeccionar sus columnas
 * reales desde el entorno de desarrollo (supera el límite de preview del
 * portal y de nuestras herramientas de research). Los nombres en
 * COLUMN_CANDIDATES y STATUS_KEYWORDS son la mejor estimación posible
 * basada en la terminología típica de compras públicas argentinas — hace
 * falta un primer test real (ver ingest_runs) para confirmar/ajustar,
 * igual que se hizo con el conector de CONTRAT.AR.
 */

const CSV_URL =
  process.env.BAC_ANUAL_CSV_URL ??
  "https://data.buenosaires.gob.ar/dataset/buenos-aires-compras/resource/24ba48bb-7c3c-4a75-9047-1e03f0b53a6e/download";

const DEFAULT_JURISDICTION = "CABA";

const COLUMN_CANDIDATES: Record<string, string[]> = {
  id: [
    "numero_proceso",
    "nro_proceso",
    "número_de_proceso",
    "numero_de_proceso",
    "id_proceso",
    "proceso",
    "expediente",
    "id",
  ],
  title: ["objeto", "objeto_de_la_contratacion", "objeto_contratacion", "descripcion", "detalle"],
  organismo: [
    "reparticion",
    "repartición",
    "reparticion_compradora",
    "unidad_ejecutora",
    "organismo",
    "dependencia",
    "unidad_operativa_de_adquisiciones",
  ],
  procedureType: ["tipo_de_procedimiento", "tipo_procedimiento", "modalidad", "procedimiento", "tipo_de_proceso"],
  status: ["estado", "estado_del_proceso", "situacion", "situación"],
  publishedAt: ["fecha_de_publicacion", "fecha_publicacion", "fecha_inicio", "fecha_de_inicio"],
  closingAt: [
    "fecha_de_apertura",
    "fecha_apertura",
    "fecha_limite",
    "fecha_límite",
    "fecha_de_cierre",
    "fecha_cierre",
  ],
  amount: ["presupuesto_oficial", "monto_estimado", "monto", "importe"],
  url: ["url", "link", "enlace"],
};

function findColumn(headerRow: string[], field: keyof typeof COLUMN_CANDIDATES): string | undefined {
  const candidates = COLUMN_CANDIDATES[field] ?? [];
  const normalize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // saca tildes/diacríticos
      .replace(/[^a-z0-9]/g, ""); // saca espacios/guiones/underscores para comparar "Número de Proceso" con "numero_de_proceso"
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

// Mapeo por palabras clave (no por valor exacto) porque no conocemos el
// texto exacto que usa el CSV real todavía.
function mapStatus(raw: string | undefined): TenderStatus {
  if (!raw) return "publicada";
  const s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (s.includes("adjudic")) return "adjudicada";
  if (s.includes("desiert") || s.includes("fracas")) return "desierta";
  if (s.includes("cancel") || s.includes("anulad") || s.includes("revocad")) return "cancelada";
  if (s.includes("cerrad") || s.includes("finaliz")) return "cerrada";
  if (s.includes("consulta")) return "en_consulta";
  if (s.includes("abiert") || s.includes("convocat") || s.includes("public") || s.includes("proceso")) {
    return "abierta";
  }
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
        if (rawStatus && status === "publicada") unmappedStatuses.add(rawStatus);

        tenders.push({
          externalId,
          title,
          organismo: (col.organismo && row[col.organismo]?.trim()) || "Organismo no informado",
          jurisdiction: DEFAULT_JURISDICTION,
          procedureType: col.procedureType ? row[col.procedureType]?.trim() : undefined,
          status,
          publishedAt: parseDate(col.publishedAt ? row[col.publishedAt] : undefined),
          closingAt: parseDate(col.closingAt ? row[col.closingAt] : undefined),
          amount: parseAmount(col.amount ? row[col.amount] : undefined),
          currency: "ARS",
          url: col.url ? row[col.url]?.trim() : undefined,
          raw: row,
        });
      }

      if (unmappedStatuses.size > 0) {
        warnings.push(
          `Estados sin mapear claro (quedaron como "publicada"), ver STATUS_KEYWORDS en bac-anual.ts: ${Array.from(unmappedStatuses).slice(0, 10).join(" | ")}`,
        );
      }

      return { tenders, warnings };
    },
  };
}
