import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { computeFitScore } from "@/lib/scoring/fit-score";
import { setTrackingStage } from "@/lib/actions/tracking";
import { isTenderStillOpen } from "@/lib/tenders/relevance";

const TABS = [
  { key: "nuevas", label: "Nuevas", stages: ["nueva"] },
  { key: "guardadas", label: "Guardadas", stages: ["guardada"] },
  { key: "descartadas", label: "Descartadas", stages: ["descartada"] },
] as const;

function scoreColor(score: number) {
  if (score >= 70) return "text-green-600 border-green-300";
  if (score >= 40) return "text-amber-600 border-amber-300";
  return "text-red-500 border-red-300";
}

export default async function OportunidadesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  const org = user?.organization;
  const { tab = "nuevas", q } = await searchParams;

  const allTenders = await db.query.tenders.findMany({
    orderBy: (fields, { desc }) => desc(fields.publishedAt),
    limit: 200,
  });

  const trackingRows = org
    ? await db.query.tenderTracking.findMany({
        where: (f, { eq }) => eq(f.organizationId, org.id),
      })
    : [];
  const stageByTenderId = new Map(trackingRows.map((t) => [t.tenderId, t.stage]));

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0];

  let filtered = allTenders.filter((t) => {
    const stage = stageByTenderId.get(t.id) ?? "nueva";
    if (!activeTab.stages.includes(stage as never)) return false;
    // Solo en "Nuevas" (oportunidades todavía sin evaluar) escondemos las
    // que ya cerraron o vencieron — no tiene sentido ofrecerlas para
    // presentarse. En "Guardadas"/"Descartadas" queda la decisión ya
    // tomada por la empresa, se ve igual aunque el proceso haya cerrado.
    if (activeTab.key === "nuevas" && !isTenderStillOpen(t)) return false;
    return true;
  });

  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter(
      (t) => t.title.toLowerCase().includes(needle) || t.organismo.toLowerCase().includes(needle),
    );
  }

  const scored = filtered
    .map((t) => ({ tender: t, fit: org ? computeFitScore(org, t) : { score: 50, reasons: [] } }))
    .sort((a, b) => b.fit.score - a.fit.score);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-brand">Oportunidades</h1>
      <p className="mt-1 text-sm text-neutral-500">
        {scored.length} {activeTab.key} · matcheadas con tu perfil
      </p>

      {org && org.profileCompleteness < 100 && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <span>
            Tu perfil está al {org.profileCompleteness}%. Completalo para mejorar la precisión del
            matching.
          </span>
          <Link href="/app/empresa" className="font-semibold text-brand hover:underline">
            Completar →
          </Link>
        </div>
      )}

      <div className="mt-6 flex gap-2 border-b border-black/10">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/app/oportunidades?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              t.key === activeTab.key
                ? "border-brand text-brand"
                : "border-transparent text-neutral-500 hover:text-brand"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="mt-4" method="GET">
        <input type="hidden" name="tab" value={activeTab.key} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Buscar por objeto, organismo, término…"
          className="w-full rounded-lg border border-black/15 px-4 py-2 text-sm"
        />
      </form>

      <ul className="mt-6 space-y-4">
        {scored.map(({ tender, fit }) => (
          <li key={tender.id} className="rounded-xl border border-black/10 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/app/oportunidades/${tender.id}`}
                  className="font-semibold text-brand hover:underline"
                >
                  {tender.title}
                </Link>
                <p className="mt-1 text-sm text-neutral-600">
                  {tender.organismo} ·{" "}
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{tender.status}</span>
                  {tender.category && (
                    <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{tender.category}</span>
                  )}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  {tender.jurisdiction}
                  {tender.closingAt && ` · Cierre: ${tender.closingAt.toLocaleDateString("es-AR")}`}
                </p>
              </div>

              <div
                className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border-2 text-sm font-bold ${scoreColor(fit.score)}`}
                title={fit.reasons.join(" · ")}
              >
                {fit.score}
                <span className="text-[9px] font-normal uppercase">afinidad</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <form action={setTrackingStage}>
                <input type="hidden" name="tenderId" value={tender.id} />
                <input type="hidden" name="stage" value="guardada" />
                <input type="hidden" name="redirectTo" value={`/app/oportunidades?tab=${activeTab.key}`} />
                <button className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">
                  Guardar
                </button>
              </form>
              <form action={setTrackingStage}>
                <input type="hidden" name="tenderId" value={tender.id} />
                <input type="hidden" name="stage" value="descartada" />
                <input type="hidden" name="redirectTo" value={`/app/oportunidades?tab=${activeTab.key}`} />
                <button className="rounded-lg border border-black/15 px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50">
                  Descartar
                </button>
              </form>
              <form action={setTrackingStage}>
                <input type="hidden" name="tenderId" value={tender.id} />
                <input type="hidden" name="stage" value="en_preparacion" />
                <input type="hidden" name="redirectTo" value={`/app/oportunidades?tab=${activeTab.key}`} />
                <button className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark">
                  Agregar a pipeline
                </button>
              </form>
            </div>
          </li>
        ))}

        {scored.length === 0 && (
          <li className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500">
            No hay licitaciones en esta vista todavía.
          </li>
        )}
      </ul>
    </div>
  );
}
