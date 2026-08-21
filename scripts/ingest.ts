/**
 * CLI de ingesta. Uso:
 *   npm run ingest                 -> corre todas las fuentes activas
 *   npm run ingest -- demo         -> corre solo la fuente con key "demo"
 *
 * Pensado para ejecutarse a mano en desarrollo y, en producción, desde un
 * cron/scheduled job (ver Railway) que llame a este script periódicamente.
 */
import "dotenv/config";
import { db } from "@/db/client";
import { ingestSource, ingestAllActiveSources } from "@/lib/ingest/run";

async function main() {
  const key = process.argv[2];

  if (key) {
    const source = await db.query.sources.findFirst({
      where: (fields, { eq }) => eq(fields.key, key),
    });
    if (!source) {
      console.error(`No existe una fuente con key="${key}". Corré "npm run db:seed" primero.`);
      process.exit(1);
    }
    const summary = await ingestSource(source);
    console.log(JSON.stringify(summary, null, 2));
    process.exit(summary.status === "error" ? 1 : 0);
  }

  const summaries = await ingestAllActiveSources();
  console.log(JSON.stringify(summaries, null, 2));
  const anyError = summaries.some((s) => s.status === "error");
  process.exit(anyError ? 1 : 0);
}

main().catch((err) => {
  console.error("Fallo la ingesta:", err);
  process.exit(1);
});
