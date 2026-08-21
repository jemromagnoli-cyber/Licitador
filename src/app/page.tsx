import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";
import { BRAND } from "@/lib/branding";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { tenders } from "@/db/schema";

async function getStats() {
  try {
    const [row] = await db
      .select({ total: sql<number>`count(*)`.mapWith(Number) })
      .from(tenders);
    return { total: row?.total ?? 0 };
  } catch {
    return { total: 0 };
  }
}

const CATEGORIAS = [
  "Construcción",
  "Salud",
  "Servicios generales",
  "IT / Software",
  "Educación",
  "Equipamiento",
  "Logística",
  "Consultoría",
];

export default async function HomePage() {
  const stats = await getStats();

  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-brand sm:text-6xl">
            Todas las licitaciones públicas de Argentina,{" "}
            <span className="text-neutral-400">en un solo lugar.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            {BRAND.name} junta las licitaciones de organismos nacionales, provinciales y
            municipales, y te muestra solo las que aplican a tu empresa — con un puntaje de
            afinidad calculado según tu rubro, tu zona y tu capacidad operativa.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/registro"
              className="rounded-lg bg-brand px-6 py-3 text-base font-semibold text-white hover:bg-brand-dark"
            >
              Crear mi cuenta gratis
            </Link>
            <Link
              href="/precios"
              className="rounded-lg border border-brand px-6 py-3 text-base font-semibold text-brand hover:bg-brand/5"
            >
              Ver planes
            </Link>
          </div>
          {stats.total > 0 && (
            <p className="mt-6 text-sm text-neutral-500">
              {stats.total} licitaciones indexadas ahora mismo.
            </p>
          )}
        </section>

        {/* Producto */}
        <section id="producto" className="border-t border-black/5 bg-neutral-50 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 px-6 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-brand">Un solo lugar</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Dejá de revisar decenas de portales de compras distintos. Centralizamos fuentes
                nacionales, provinciales y municipales, y las actualizamos automáticamente.
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-brand">Afinidad calculada</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Un algoritmo transparente puntúa cada licitación de 0 a 100 según tu rubro, zona,
                montos de interés y condiciones de pago — vos definís las reglas.
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-brand">Pipeline en equipo</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Guardá, descartá y hacé seguimiento de cada oportunidad en un panel colaborativo,
                con alertas cuando se acerca un cierre.
              </p>
            </div>
          </div>
        </section>

        {/* Categorías */}
        <section id="categorias" className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-2xl font-bold text-brand">Cubrimos todos los rubros</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {CATEGORIAS.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-brand/20 px-4 py-2 text-sm text-brand"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo funciona */}
        <section id="como-funciona" className="border-t border-black/5 bg-neutral-50 py-16">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-center text-2xl font-bold text-brand">Cómo funciona</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3">
              <li>
                <div className="mb-3 text-3xl font-extrabold text-accent">1</div>
                <h4 className="font-semibold">Configurá tu perfil</h4>
                <p className="mt-1 text-sm text-neutral-600">
                  CUIT, rubros, zonas y montos de interés. Tres minutos, sin trámites.
                </p>
              </li>
              <li>
                <div className="mb-3 text-3xl font-extrabold text-accent">2</div>
                <h4 className="font-semibold">Recibí oportunidades</h4>
                <p className="mt-1 text-sm text-neutral-600">
                  Vemos automáticamente qué licitaciones activas matchean con tu empresa.
                </p>
              </li>
              <li>
                <div className="mb-3 text-3xl font-extrabold text-accent">3</div>
                <h4 className="font-semibold">Hacé seguimiento</h4>
                <p className="mt-1 text-sm text-neutral-600">
                  Guardá las que te interesan y llevá el estado de cada una hasta la adjudicación.
                </p>
              </li>
            </ol>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
