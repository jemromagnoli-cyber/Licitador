import type { TenderSource } from "./types";
import { createDemoSource } from "./demo";
import { createBacOcdsSource } from "./bac-ocds";
import { createBacAnualSource } from "./bac-anual";
import { createBacAperturaSource } from "./bac-apertura";
import { createContratarCkanSource } from "./contratar-ckan";

/**
 * Registro central de conectores. Sumar una fuente nueva = escribir un
 * archivo que exporte un TenderSource y agregarlo acá + una fila en la
 * tabla `sources` (ver src/db/seed.ts) con el mismo `connectorKey`.
 *
 * bac-ocds y bac-anual siguen registrados (por si sirven de base para otra
 * fuente más adelante) pero están inactivos en el seed — la fuente activa
 * para BAC es "bac-apertura" (ver bac-apertura.ts para el porqué).
 */
export function buildConnectorRegistry(): Map<string, TenderSource> {
  const sources = [
    createDemoSource(),
    createBacOcdsSource(),
    createBacAnualSource(),
    createBacAperturaSource(),
    createContratarCkanSource(),
  ];
  return new Map(sources.map((s) => [s.key, s]));
}
