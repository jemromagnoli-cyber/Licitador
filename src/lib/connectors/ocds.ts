import type { NormalizedTender, TenderStatus } from "./types";

/**
 * Parser genérico de OCDS (Open Contracting Data Standard).
 *
 * Varias jurisdicciones argentinas publican sus compras en este formato
 * estándar internacional — entre ellas Buenos Aires Compras (BAC/CABA). Al
 * escribir el parser contra el estándar (y no contra un publisher puntual),
 * el mismo código sirve para sumar cualquier otra fuente OCDS (Uruguay,
 * Chile, Mendoza, etc.) con solo apuntar a otra URL — ver roadmap fase 2/LATAM.
 *
 * Referencia: https://standard.open-contracting.org/latest/en/schema/release/
 */

interface OcdsAmount {
  amount?: number;
  currency?: string;
}

interface OcdsPeriod {
  startDate?: string;
  endDate?: string;
}

interface OcdsOrganization {
  name?: string;
}

interface OcdsRelease {
  ocid?: string;
  id?: string;
  date?: string;
  tag?: string[];
  buyer?: OcdsOrganization;
  tender?: {
    id?: string;
    title?: string;
    description?: string;
    status?: string;
    procurementMethod?: string;
    procurementMethodDetails?: string;
    mainProcurementCategory?: string;
    procuringEntity?: OcdsOrganization;
    tenderPeriod?: OcdsPeriod;
    value?: OcdsAmount;
  };
}

interface OcdsReleasePackage {
  uri?: string;
  publishedDate?: string;
  releases?: OcdsRelease[];
}

const STATUS_MAP: Record<string, TenderStatus> = {
  planning: "publicada",
  planned: "publicada",
  active: "abierta",
  cancelled: "cancelada",
  unsuccessful: "desierta",
  complete: "cerrada",
  withdrawn: "cancelada",
};

function mapStatus(ocdsStatus?: string): TenderStatus {
  if (!ocdsStatus) return "publicada";
  return STATUS_MAP[ocdsStatus.toLowerCase()] ?? "publicada";
}

/**
 * Convierte un release package OCDS completo en licitaciones normalizadas.
 * Se descartan los releases que no tengan tag "tender" o no traigan título.
 */
export function normalizeOcdsReleasePackage(
  pkg: OcdsReleasePackage,
  jurisdiction: string,
): { tenders: NormalizedTender[]; warnings: string[] } {
  const warnings: string[] = [];
  const tenders: NormalizedTender[] = [];

  for (const release of pkg.releases ?? []) {
    const t = release.tender;
    if (!t || !t.title) {
      continue;
    }

    const externalId = t.id ?? release.ocid ?? release.id;
    if (!externalId) {
      warnings.push(`Release sin id/ocid ignorado: ${JSON.stringify(release).slice(0, 120)}`);
      continue;
    }

    tenders.push({
      externalId,
      title: t.title,
      organismo: t.procuringEntity?.name ?? release.buyer?.name ?? "Organismo no informado",
      jurisdiction,
      category: t.mainProcurementCategory,
      procedureType: t.procurementMethodDetails ?? t.procurementMethod,
      status: mapStatus(t.status),
      publishedAt: release.date ? new Date(release.date) : undefined,
      closingAt: t.tenderPeriod?.endDate ? new Date(t.tenderPeriod.endDate) : undefined,
      amount: t.value?.amount,
      currency: t.value?.currency ?? "ARS",
      url: pkg.uri,
      raw: release,
    });
  }

  return { tenders, warnings };
}

export type { OcdsReleasePackage };
