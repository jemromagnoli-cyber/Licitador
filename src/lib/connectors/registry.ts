import type { TenderSource } from "./types";
import { createDemoSource } from "./demo";
import { createBacOcdsSource } from "./bac-ocds";
import { createBacAnualSource } from "./bac-anual";
import { createContratarCkanSource } from "./contratar-ckan";

/**
 * Registro central de conectores. Sumar una fuente nueva = escribir un
 * archivo que exporte un TenderSource y agregarlo acá + una fila en la
 * tabla `sources` (ver src/db/seed.ts) con el mismo `connectorKey`.
 *
 * bac-ocds sigue registrado (el parser OCDS es reutilizable para otras
 * jurisdicciones que publiquen bajo ese estándar) pero la fuente "bac-ocds"
 * está inactiva en el seed — ver bac-anual.ts para el porqué.
 */
export function buildConnectorRegistry(): Map<string, TenderSource> {
  const sources = [
    createDemoSource(),
    createBacOcdsSource(),
    createBacAnualSource(),
    createContratarCkanSource(),
  ];
  return new Map(sources.map((s) => [s.key, s]));
}
