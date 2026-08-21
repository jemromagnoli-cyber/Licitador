import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { db } from "@/db/client";
import { sources } from "@/db/schema";
   export const dynamic = "force-dynamic";

export default async function CoberturaPage() {
  const allSources = await db.select().from(sources);

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-16">
          <h1 className="text-3xl font-extrabold text-brand">Cobertura de fuentes</h1>
          <p className="mt-4 text-neutral-600">
            Estas son las fuentes de datos configuradas en esta instancia. Sumamos fuentes nuevas
            de forma incremental — ver el roadmap para el detalle de qué sigue.
          </p>

          <div className="mt-8 divide-y divide-black/10 rounded-xl border border-black/10">
            {allSources.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-neutral-500">
                    {s.jurisdictionName} · {s.jurisdictionType}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    s.active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  {s.active ? "Activa" : "Pendiente de activar"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
