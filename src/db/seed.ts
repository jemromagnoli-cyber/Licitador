import "dotenv/config";
import { db } from "./client";
import { sources } from "./schema";

/**
 * Crea (si no existen) las filas de `sources` que corresponden a los
 * conectores implementados en src/lib/connectors. Correr con:
 *   npm run db:seed
 */
const SOURCES: (typeof sources.$inferInsert)[] = [
  {
    key: "demo",
    name: "Datos de demostración",
    jurisdictionType: "nacional",
    jurisdictionName: "Demo",
    connectorKey: "demo",
    active: true,
  },
  {
    key: "bac-ocds",
    name: "Buenos Aires Compras (BAC)",
    jurisdictionType: "municipal",
    jurisdictionName: "CABA",
    baseUrl: "https://data.buenosaires.gob.ar",
    connectorKey: "bac-ocds",
    // Inactiva hasta confirmar BAC_OCDS_URL en producción (ver bac-ocds.ts).
    active: false,
  },
  {
    key: "contratar-ckan",
    name: "CONTRAT.AR (obra pública, vía datos.gob.ar)",
    jurisdictionType: "nacional",
    jurisdictionName: "Nación",
    baseUrl: "https://datos.gob.ar",
    connectorKey: "contratar-ckan",
    // Inactiva hasta confirmar el dataset id / columnas en producción.
    active: false,
  },
];

async function main() {
  for (const s of SOURCES) {
    await db
      .insert(sources)
      .values(s)
      .onConflictDoUpdate({ target: sources.key, set: { ...s } });
    console.log(`✓ source "${s.key}" lista`);
  }
  console.log("Seed de fuentes completo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
