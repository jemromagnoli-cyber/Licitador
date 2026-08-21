import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { computeFitScore } from "@/lib/scoring/fit-score";
import { setTrackingStage } from "@/lib/actions/tracking";

export default async function TenderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const org = user?.organization;

  const tender = await db.query.tenders.findFirst({ where: (f, { eq }) => eq(f.id, id) });
  if (!tender) notFound();

  const fit = org ? computeFitScore(org, tender) : { score: 50, reasons: [] };

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
  const fmtAmount = (n: number | null) =>
    n ? n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }) : "—";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link href="/app/oportunidades" className="text-sm text-brand hover:underline">
        ← Volver al listado
      </Link>

      <div className="mt-4 rounded-xl border border-black/10 bg-white p-6">
        {tender.url && (
          <p className="truncate text-xs uppercase tracking-wide text-neutral-400">{tender.url}</p>
        )}
        <h1 className="mt-2 text-xl font-bold text-brand">{tender.title}</h1>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Comprador</dt>
            <dd className="font-medium">{tender.organismo}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Ubicación</dt>
            <dd className="font-medium">{tender.jurisdiction}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Estado</dt>
            <dd className="font-medium">{tender.status}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Rubro</dt>
            <dd className="font-medium">{tender.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Publicación</dt>
            <dd className="font-medium">{fmt(tender.publishedAt)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Cierre / apertura</dt>
            <dd className="font-medium">{fmt(tender.closingAt)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Monto estimado</dt>
            <dd className="font-medium">{fmtAmount(tender.amount)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Procedimiento</dt>
            <dd className="font-medium">{tender.procedureType ?? "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-brand">Afinidad con tu empresa</h2>
        <div className="mt-3 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-brand text-xl font-extrabold text-brand">
            {fit.score}
          </div>
          <ul className="text-sm text-neutral-600">
            {fit.reasons.length > 0 ? (
              fit.reasons.map((r) => <li key={r}>• {r}</li>)
            ) : (
              <li>Completá tu perfil de empresa para ver el detalle del cálculo.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-black/15 bg-neutral-50 p-6 text-sm text-neutral-600">
        <p className="font-semibold text-neutral-700">Resumen con IA y checklist — próximamente (fase 2)</p>
        <p className="mt-1">
          Acá vamos a mostrar un resumen ejecutivo del pliego y un checklist de requisitos
          generados con IA. Ver <code className="rounded bg-white px-1">ROADMAP.md</code> del
          proyecto.
        </p>
      </div>

      <div className="mt-6 flex gap-2">
        <form action={setTrackingStage}>
          <input type="hidden" name="tenderId" value={tender.id} />
          <input type="hidden" name="stage" value="guardada" />
          <input type="hidden" name="redirectTo" value={`/app/oportunidades/${tender.id}`} />
          <button className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold hover:bg-neutral-50">
            Guardar
          </button>
        </form>
        <form action={setTrackingStage}>
          <input type="hidden" name="tenderId" value={tender.id} />
          <input type="hidden" name="stage" value="en_preparacion" />
          <input type="hidden" name="redirectTo" value={`/app/oportunidades/${tender.id}`} />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Agregar a pipeline
          </button>
        </form>
        {tender.url && (
          <a
            href={tender.url}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
          >
            Ver pliego original
          </a>
        )}
      </div>
    </div>
  );
}
