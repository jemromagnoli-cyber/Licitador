import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ingestRuns, sources, tenders } from "@/db/schema";
import { buildConnectorRegistry } from "@/lib/connectors/registry";
import type { NormalizedTender } from "@/lib/connectors/types";

export interface IngestSummary {
  sourceKey: string;
  status: "success" | "partial" | "error";
  itemsFound: number;
  itemsCreated: number;
  itemsUpdated: number;
  warnings: string[];
  errorMessage?: string;
}

/**
 * Corre la ingesta de UNA fuente: llama al conector, normaliza, hace
 * upsert (crear o actualizar) en la tabla `tenders` deduplicando por
 * (source_id, external_id), y deja un registro en `ingest_runs` para
 * observabilidad — así el dashboard puede mostrar "última actualización"
 * y detectar fuentes que empiezan a fallar.
 */
export async function ingestSource(sourceRow: typeof sources.$inferSelect): Promise<IngestSummary> {
  const registry = buildConnectorRegistry();
  const connector = registry.get(sourceRow.connectorKey);

  const [run] = await db
    .insert(ingestRuns)
    .values({ sourceId: sourceRow.id })
    .returning();

  if (!connector) {
    const errorMessage = `No hay conector registrado para connectorKey="${sourceRow.connectorKey}"`;
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), status: "error", errorMessage })
      .where(eq(ingestRuns.id, run!.id));
    return {
      sourceKey: sourceRow.key,
      status: "error",
      itemsFound: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      warnings: [],
      errorMessage,
    };
  }

  try {
    const { tenders: found, warnings = [] } = await connector.fetchTenders();

    let created = 0;
    let updated = 0;

    for (const t of found) {
      const wasCreated = await upsertTender(sourceRow.id, t);
      if (wasCreated) created++;
      else updated++;
    }

    await db
      .update(sources)
      .set({ lastRunAt: new Date() })
      .where(eq(sources.id, sourceRow.id));

    const status = warnings.length > 0 && found.length === 0 ? "partial" : "success";

    await db
      .update(ingestRuns)
      .set({
        finishedAt: new Date(),
        status,
        itemsFound: found.length,
        itemsCreated: created,
        itemsUpdated: updated,
        errorMessage: warnings.length ? warnings.join(" | ").slice(0, 2000) : null,
      })
      .where(eq(ingestRuns.id, run!.id));

    return {
      sourceKey: sourceRow.key,
      status,
      itemsFound: found.length,
      itemsCreated: created,
      itemsUpdated: updated,
      warnings,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), status: "error", errorMessage: errorMessage.slice(0, 2000) })
      .where(eq(ingestRuns.id, run!.id));

    return {
      sourceKey: sourceRow.key,
      status: "error",
      itemsFound: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      warnings: [],
      errorMessage,
    };
  }
}

/** true si se creó una fila nueva, false si se actualizó una existente. */
async function upsertTender(sourceId: string, t: NormalizedTender): Promise<boolean> {
  const existing = await db.query.tenders.findFirst({
    where: (fields, { and, eq: eqOp }) =>
      and(eqOp(fields.sourceId, sourceId), eqOp(fields.externalId, t.externalId)),
    columns: { id: true },
  });

  const values = {
    sourceId,
    externalId: t.externalId,
    title: t.title,
    organismo: t.organismo,
    jurisdiction: t.jurisdiction,
    category: t.category,
    procedureType: t.procedureType,
    status: t.status,
    publishedAt: t.publishedAt,
    closingAt: t.closingAt,
    amount: t.amount,
    currency: t.currency ?? "ARS",
    url: t.url,
    raw: t.raw as object | undefined,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(tenders).set(values).where(eq(tenders.id, existing.id));
    return false;
  }

  await db.insert(tenders).values(values);
  return true;
}

/** Corre la ingesta de todas las fuentes activas, en secuencia. */
export async function ingestAllActiveSources(): Promise<IngestSummary[]> {
  const activeSources = await db.query.sources.findMany({
    where: (fields, { eq: eqOp }) => eqOp(fields.active, true),
  });

  const summaries: IngestSummary[] = [];
  for (const source of activeSources) {
    summaries.push(await ingestSource(source));
  }
  return summaries;
}
