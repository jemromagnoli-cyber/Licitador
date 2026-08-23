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
    name: "Buenos Aires Compras (BAC) — histórico completo OCDS",
    jurisdictionType: "municipal",
    jurisdictionName: "CABA",
    baseUrl: "https://data.buenosaires.gob.ar",
    connectorKey: "bac-ocds",
    // Inactiva: probado en producción, son 15 años de historial (desde
    // 2011) en un solo archivo — mezcla procesos cerrados con vigentes y
    // tarda varios minutos en descargar/procesar. Reemplazada por
    // "bac-anual" (ver abajo), acotada al año en curso.
    active: false,
  },
  {
    key: "bac-anual",
    name: "Buenos Aires Compras (BAC) — año en curso",
    jurisdictionType: "municipal",
    jurisdictionName: "CABA",
    baseUrl: "https://data.buenosaires.gob.ar",
    connectorKey: "bac-anual",
    // Inactiva: probado en producción, el recurso "Anual" resultó ser un
    // archivo histórico que se actualiza con poca frecuencia — el 100% de
    // los procesos que trajo ya tenían fecha de cierre vencida, incluso
    // marcados como activos. Reemplazada por "bac-apertura", que lee
    // directamente el buscador "En Apertura" del propio portal BAC.
    active: false,
  },
  {
    key: "bac-apertura",
    name: "Buenos Aires Compras (BAC) — procesos en apertura",
    jurisdictionType: "municipal",
    jurisdictionName: "CABA",
    baseUrl: "https://www.buenosairescompras.gob.ar",
    connectorKey: "bac-apertura",
    active: true,
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
