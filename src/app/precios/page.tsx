import Link from "next/link";
import { Navbar } from "@/components/marketing/Navbar";
import { Footer } from "@/components/marketing/Footer";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: "$99.999",
    period: "/mes + IVA",
    users: "1 usuario",
    description: "Para empezar a ordenar la búsqueda de licitaciones sin perder oportunidades.",
    features: [
      "Licitaciones nacionales y provinciales",
      "Búsqueda inteligente con filtros y alertas",
      "Puntaje de afinidad por licitación",
      "Resúmenes con IA + checklist de requisitos",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: "$249.999",
    period: "/mes + IVA",
    users: "Hasta 3 usuarios",
    description: "Para equipos que necesitan cobertura amplia y trabajar la oportunidad en conjunto.",
    highlighted: true,
    features: [
      "Todo lo de Starter",
      "Cobertura municipal completa",
      "Licitaciones de empresas públicas y privadas",
      "Panel colaborativo (kanban)",
      "Datos históricos y analítica (en desarrollo)",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "$199.999",
    period: "/usuario/mes (mín. 5)",
    users: "Escalable",
    description: "Para operaciones a escala, con integración técnica y soporte dedicado.",
    features: [
      "Todo lo de Pro",
      "Gestión multi-CUIT",
      "API REST y webhooks",
      "Ejecutivo de cuenta dedicado",
      "Soporte prioritario",
    ],
    comingSoon: true,
  },
];

export default function PreciosPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-8 text-center">
          <h1 className="text-3xl font-extrabold text-brand sm:text-4xl">Planes simples y transparentes</h1>
          <p className="mt-4 text-neutral-600">
            Empezá gratis 14 días, sin tarjeta. Cancelás cuando quieras desde tu cuenta.
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`flex flex-col rounded-2xl border p-6 ${
                plan.highlighted ? "border-brand shadow-lg" : "border-black/10"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-3 w-fit rounded-full bg-accent px-3 py-1 text-xs font-bold text-brand-dark">
                  Más elegido
                </span>
              )}
              <h3 className="text-lg font-bold text-brand">{plan.name}</h3>
              <p className="mt-1 text-sm text-neutral-500">{plan.users}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-extrabold">{plan.price}</span>
                <span className="text-sm text-neutral-500">{plan.period}</span>
              </div>
              <p className="mt-3 text-sm text-neutral-600">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/registro"
                className={`mt-6 rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                  plan.comingSoon
                    ? "cursor-not-allowed bg-neutral-100 text-neutral-400"
                    : "bg-brand text-white hover:bg-brand-dark"
                }`}
                aria-disabled={plan.comingSoon}
              >
                {plan.comingSoon ? "Próximamente" : "Empezar prueba gratis"}
              </Link>
            </div>
          ))}
        </section>
      </main>
      <Footer />
    </>
  );
}
