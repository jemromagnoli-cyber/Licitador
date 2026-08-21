import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/db/client";
import { setTrackingStage } from "@/lib/actions/tracking";

const COLUMNS = [
  { key: "en_preparacion", label: "En preparación" },
  { key: "presentada", label: "Presentada" },
  { key: "ganada", label: "Ganada" },
  { key: "perdida", label: "Perdida" },
] as const;

export default async function PipelinePage() {
  const user = await getCurrentUser();
  const org = user?.organization;

  const rows = org
    ? await db.query.tenderTracking.findMany({
        where: (f, { inArray }) => inArray(f.stage, COLUMNS.map((c) => c.key)),
        with: { tender: true },
      })
    : [];

  const byOrg = rows.filter((r) => r.organizationId === org?.id);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold text-brand">Mis licitaciones</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Seguimiento de las oportunidades que agregaste desde Oportunidades.
      </p>

      {byOrg.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-neutral-500">
          Todavía no agregaste licitaciones a tu panel. Sumalas desde{" "}
          <Link href="/app/oportunidades" className="text-brand hover:underline">
            Oportunidades
          </Link>
          .
        </p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {COLUMNS.map((col) => (
            <div key={col.key} className="rounded-xl bg-neutral-100 p-3">
              <h2 className="mb-3 text-sm font-semibold text-neutral-600">{col.label}</h2>
              <div className="space-y-3">
                {byOrg
                  .filter((r) => r.stage === col.key)
                  .map((r) => (
                    <div key={r.id} className="rounded-lg bg-white p-3 shadow-sm">
                      <Link
                        href={`/app/oportunidades/${r.tenderId}`}
                        className="line-clamp-3 text-xs font-semibold text-brand hover:underline"
                      >
                        {r.tender?.title}
                      </Link>
                      <p className="mt-1 text-[11px] text-neutral-500">{r.tender?.organismo}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {COLUMNS.filter((c) => c.key !== col.key).map((c) => (
                          <form key={c.key} action={setTrackingStage}>
                            <input type="hidden" name="tenderId" value={r.tenderId} />
                            <input type="hidden" name="stage" value={c.key} />
                            <input type="hidden" name="redirectTo" value="/app/pipeline" />
                            <button className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] hover:bg-neutral-200">
                              → {c.label}
                            </button>
                          </form>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
