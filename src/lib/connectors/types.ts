/**
 * Contrato que debe cumplir cualquier conector de datos (scraper, cliente de
 * API abierta, parser de CSV, etc). Cada fuente de licitaciones (COMPR.AR,
 * Buenos Aires Compras, un portal provincial, ...) se implementa como un
 * TenderSource independiente y se registra en `registry.ts`.
 *
 * Esto es lo que permite sumar una fuente nueva sin tocar el resto del
 * sistema: el motor de ingesta (`lib/ingest/run.ts`) no sabe nada de HTML,
 * OCDS, CSV ni CKAN — solo sabe iterar TenderSource.fetchTenders() y guardar
 * TenderNormalized[] en la base de datos.
 */

export type TenderStatus =
  | "publicada"
  | "en_consulta"
  | "abierta"
  | "adjudicada"
  | "desierta"
  | "cancelada"
  | "cerrada";

export interface NormalizedTender {
  /** Identificador único dentro de la fuente (nº de expediente, id de la API, etc). */
  externalId: string;
  title: string;
  organismo: string;
  /** Jurisdicción en texto libre pero consistente: "Nación", "CABA", "Córdoba", ... */
  jurisdiction: string;
  category?: string;
  procedureType?: string;
  status: TenderStatus;
  publishedAt?: Date;
  closingAt?: Date;
  amount?: number;
  currency?: string;
  /** Link a la licitación en el portal de origen. */
  url?: string;
  /** Payload crudo tal cual vino de la fuente, para debug/auditoría. */
  raw?: unknown;
}

export interface TenderSourceResult {
  tenders: NormalizedTender[];
  /** Advertencias no fatales (ej: algunas filas no se pudieron parsear). */
  warnings?: string[];
}

export interface TenderSource {
  /** Debe matchear `sources.connector_key` en la base de datos. */
  key: string;
  label: string;
  fetchTenders(): Promise<TenderSourceResult>;
}
