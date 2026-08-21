import type { organizations, tenders } from "@/db/schema";

type OrgProfile = typeof organizations.$inferSelect;
type Tender = typeof tenders.$inferSelect;

/**
 * Fit Score — algoritmo DETERMINISTA (no usa IA/ML) que estima qué tan
 * relevante es una licitación para el perfil de una empresa, 0-100.
 *
 * Se mantiene determinista a propósito: tiene que ser explicable ("por qué
 * me mostraron esto") y barato de recalcular para miles de licitaciones en
 * cada request. El resumen ejecutivo y el checklist con IA son una capa
 * aparte (fase 2, ver ROADMAP.md) que se apoya en este score pero no lo
 * reemplaza.
 */
export interface FitScoreBreakdown {
  score: number; // 0-100
  reasons: string[];
}

export function computeFitScore(org: OrgProfile, tender: Tender): FitScoreBreakdown {
  let score = 50;
  const reasons: string[] = [];

  // Rubro / actividad comercial
  if (tender.category && org.activities.length > 0) {
    if (org.activities.some((a) => a.toLowerCase() === tender.category!.toLowerCase())) {
      score += 25;
      reasons.push(`Coincide con tu rubro "${tender.category}"`);
    } else {
      score -= 5;
    }
  }

  // Zona objetivo
  if (org.zonaObjetivo.length > 0) {
    if (org.zonaObjetivo.some((z) => z.toLowerCase() === tender.jurisdiction.toLowerCase())) {
      score += 15;
      reasons.push(`Jurisdicción dentro de tu zona objetivo (${tender.jurisdiction})`);
    } else {
      score -= 15;
      reasons.push(`Fuera de tu zona objetivo (${tender.jurisdiction})`);
    }
  }

  // Rango de montos
  if (tender.amount) {
    if (org.montoMinimo && tender.amount < org.montoMinimo) {
      score -= 15;
      reasons.push("Monto por debajo de tu mínimo de interés");
    }
    if (org.montoMaximo && tender.amount > org.montoMaximo) {
      score -= 20;
      reasons.push("Monto por encima de tu máximo de interés");
    }
    if (org.montoMaximoTipico && tender.amount > org.montoMaximoTipico) {
      score -= 10;
      reasons.push("Monto por encima de tu capacidad operativa típica");
    }
  }

  // Palabras excluidas
  const haystack = tender.title.toLowerCase();
  const excludedHit = org.excludedKeywords.find((kw) => haystack.includes(kw.toLowerCase()));
  if (excludedHit) {
    score -= 40;
    reasons.push(`Contiene una palabra excluida de tu perfil ("${excludedHit}")`);
  }

  // Cierre ya pasado -> no sirve mostrarlo como oportunidad activa
  if (tender.closingAt && tender.closingAt.getTime() < Date.now()) {
    score -= 30;
    reasons.push("El cierre ya pasó");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons };
}
