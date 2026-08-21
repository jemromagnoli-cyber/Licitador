import type { NormalizedTender, TenderSource, TenderSourceResult } from "./types";

/**
 * Conector DEMO — no llama a ningún sitio externo.
 *
 * Genera licitaciones sintéticas pero realistas (organismos reales,
 * jurisdicciones reales, vocabulario real de contrataciones públicas
 * argentinas) para que todo el producto — ingesta, base de datos, scoring,
 * dashboard — funcione de punta a punta desde el primer `npm run ingest`,
 * sin depender de que un portal gubernamental esté disponible o de haber
 * confirmado ya el endpoint exacto de una fuente real.
 *
 * Reemplazá/complementá esto con conectores reales (ver bac-ocds.ts,
 * contratar-ckan.ts) a medida que se validen los endpoints en producción.
 */

// PRNG determinístico (mulberry32) para que la demo sea reproducible entre
// corridas — más fácil de debuggear que Math.random().
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260821);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

const ORGANISMOS: { name: string; jurisdiction: string; type: string }[] = [
  { name: "Ministerio de Producción y Ambiente", jurisdiction: "Tierra del Fuego", type: "provincial" },
  { name: "Hospital Regional Río Grande", jurisdiction: "Tierra del Fuego", type: "provincial" },
  { name: "Secretaría de Legal y Técnica", jurisdiction: "CABA", type: "municipal" },
  { name: "Ente Provincial de Agua y Saneamiento (EPAS)", jurisdiction: "San Luis", type: "provincial" },
  { name: "Ministerio de Salud", jurisdiction: "Nación", type: "nacional" },
  { name: "Ministerio de Educación", jurisdiction: "Nación", type: "nacional" },
  { name: "Vialidad Nacional", jurisdiction: "Nación", type: "nacional" },
  { name: "AySA", jurisdiction: "Buenos Aires", type: "empresa_publica" },
  { name: "PAMI", jurisdiction: "Nación", type: "nacional" },
  { name: "Ministerio de Infraestructura", jurisdiction: "Córdoba", type: "provincial" },
  { name: "Municipalidad de Rosario", jurisdiction: "Santa Fe", type: "municipal" },
  { name: "Municipalidad de Mendoza", jurisdiction: "Mendoza", type: "municipal" },
  { name: "Instituto Provincial de la Vivienda", jurisdiction: "Chaco", type: "provincial" },
  { name: "Aerolíneas Argentinas", jurisdiction: "Nación", type: "empresa_publica" },
  { name: "Banco Nación", jurisdiction: "Nación", type: "empresa_publica" },
  { name: "Edenor", jurisdiction: "Buenos Aires", type: "empresa_privada" },
  { name: "Ministerio de Seguridad", jurisdiction: "Buenos Aires", type: "provincial" },
  { name: "Dirección de Vialidad", jurisdiction: "Neuquén", type: "provincial" },
  { name: "Ministerio de Desarrollo Social", jurisdiction: "Nación", type: "nacional" },
  { name: "Municipalidad de Salta", jurisdiction: "Salta", type: "municipal" },
];

const CATEGORIAS = [
  "Construcción",
  "Salud",
  "Servicios generales",
  "IT / Software",
  "Educación",
  "Equipamiento",
  "Logística",
  "Consultoría",
  "Energía",
  "Alimentos",
  "Seguridad",
  "Mantenimiento",
];

const PROCEDIMIENTOS = [
  "Licitación Pública",
  "Licitación Privada",
  "Contratación Directa",
  "Contratación Menor",
  "Subasta Inversa",
];

const OBJETOS = [
  "Adquisición de cámaras trampa y tarjetas de memoria para relevamiento de fauna nativa y exótica",
  "Provisión de insumos médicos y descartables para hospitales de la red pública",
  "Contratación de servicio de limpieza integral para edificios públicos",
  "Adquisición de equipamiento informático y licencias de software",
  "Construcción de cordón cuneta y repavimentación de arterias urbanas",
  "Provisión de alimentos secos para comedores escolares",
  "Servicio de mantenimiento de espacios verdes y arbolado urbano",
  "Adquisición de uniformes y equipamiento de seguridad para personal municipal",
  "Contratación de servicio de vigilancia y seguridad privada",
  "Provisión e instalación de luminarias led para alumbrado público",
  "Servicio de transporte escolar",
  "Adquisición de medicamentos oncológicos",
  "Contratación de consultoría para diagnóstico de procesos administrativos",
  "Provisión de combustibles para flota de vehículos oficiales",
  "Construcción de red de agua potable en barrio periférico",
];

const STATUSES = ["publicada", "en_consulta", "abierta"] as const;

function randomDateWithinDays(daysFromNow: number, spread: number): Date {
  const now = Date.now();
  const offsetDays = daysFromNow + int(-spread, spread);
  return new Date(now + offsetDays * 24 * 60 * 60 * 1000);
}

function buildTender(i: number): NormalizedTender {
  const org = pick(ORGANISMOS);
  const objeto = pick(OBJETOS);
  const categoria = pick(CATEGORIAS);
  const procedimiento = pick(PROCEDIMIENTOS);
  const expediente = `${int(10000, 99999)}/2026`;
  const raf = int(100, 999);
  const publishedAt = randomDateWithinDays(-int(1, 20), 3);
  const closingAt = randomDateWithinDays(int(3, 45), 2);

  const title = `EXPEDIENTE N° ${expediente} «${objeto.toUpperCase()}» – RAF ${raf}.-`;

  return {
    externalId: `demo-${i}-${expediente}`,
    title,
    organismo: org.name,
    jurisdiction: org.jurisdiction,
    category: categoria,
    procedureType: procedimiento,
    status: pick(STATUSES),
    publishedAt,
    closingAt,
    amount: int(2, 400) * 1_000_000,
    currency: "ARS",
    url: `https://ejemplo-portal-compras.gob.ar/?p=${int(100000, 999999)}`,
    raw: { demo: true, org, objeto, categoria, procedimiento },
  };
}

export function createDemoSource(count = 90): TenderSource {
  return {
    key: "demo",
    label: "Datos de demostración",
    async fetchTenders(): Promise<TenderSourceResult> {
      const tenders = Array.from({ length: count }, (_, i) => buildTender(i));
      return { tenders };
    },
  };
}
