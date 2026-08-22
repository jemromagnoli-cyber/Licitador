import type { TenderStatus } from "@/lib/connectors/types";

/**
 * Estados que consideramos "terminales": el proceso ya se resolvió (se
 * adjudicó, quedó desierto, se canceló o directamente cerró) y no tiene
 * sentido mostrárselo a una empresa como oportunidad para presentarse.
 *
 * Esto importa especialmente para fuentes que publican volcados históricos
 * completos en vez de solo lo vigente — BAC (Buenos Aires Compras) publica
 * su historial completo desde 2011 en un solo archivo OCDS, mezclando
 * procesos abiertos con procesos cerrados hace años. Sin este filtro, la
 * ingesta llenaría la base de licitaciones ya resueltas.
 */
export const TERMINAL_TENDER_STATUSES: readonly TenderStatus[] = [
  "adjudicada",
  "desierta",
  "cancelada",
  "cerrada",
];

/**
 * true si la licitación todavía es una oportunidad accionable: no está en
 * un estado terminal, y si tiene fecha de cierre conocida, todavía no pasó.
 *
 * Se usa en dos puntos, a propósito (doble seguro):
 *   1. Al ingerir (src/lib/ingest/run.ts) — para no guardar en la base
 *      procesos que ya sabemos que están cerrados/vencidos al momento de
 *      la carga (evita ensuciar la base con historial irrelevante).
 *   2. Al listar "Oportunidades" (src/app/app/oportunidades/page.tsx) —
 *      por si algo cerró DESPUÉS de haber sido cargado, o si en el futuro
 *      alguna fuente no informa bien el status.
 */
export function isTenderStillOpen(
  t: { status: TenderStatus; closingAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (TERMINAL_TENDER_STATUSES.includes(t.status)) return false;
  if (t.closingAt && t.closingAt.getTime() < now.getTime()) return false;
  return true;
}
