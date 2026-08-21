import type { TenderSource } from "./types";
import { createDemoSource } from "./demo";
import { createBacOcdsSource } from "./bac-ocds";
import { createContratarCkanSource } from "./contratar-ckan";

/**
 * Registro central de conectores. Sumar una fuente nueva = escribir un
 * archivo que exporte un TenderSource y agregarlo acá + una fila en la
 * tabla `sources` (ver src/db/seed.ts) con el mismo `connectorKey`.
 */
export function buildConnectorRegistry(): Map<string, TenderSource> {
  const sources = [createDemoSource(), createBacOcdsSource(), createContratarCkanSource()];
  return new Map(sources.map((s) => [s.key, s]));
}
