import { updateOrganizationProfile } from "@/lib/actions/organization";
import type { organizations } from "@/db/schema";

const FACTURACION_OPTIONS = ["<50", "50-200", "200-1000", "1000-5000", ">5000"];
const EMPLEADOS_OPTIONS = ["1-10", "11-50", "51-250", "251-1000", ">1000"];
const TERMINOS_PAGO_OPTIONS = ["Anticipo", "Contraentrega", "30 días", "60 días", "90 días", "180 días", "Mensual", "Por hito"];

export function OrganizationProfileForm({
  org,
  submitLabel,
}: {
  org: Partial<typeof organizations.$inferSelect>;
  submitLabel: string;
}) {
  return (
    <form action={updateOrganizationProfile} className="space-y-8">
      <section className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-brand">Identificación</h2>
        <p className="text-sm text-neutral-500">Datos básicos de tu empresa.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">CUIT</label>
            <input
              name="cuit"
              defaultValue={org.cuit ?? ""}
              placeholder="30-71234567-8"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Razón social</label>
            <input
              name="razonSocial"
              defaultValue={org.razonSocial ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-brand">Perfil de matching</h2>
        <p className="text-sm text-neutral-500">Define qué oportunidades son relevantes para tu empresa.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Rubros / actividades (separados por coma)</label>
            <input
              name="activities"
              defaultValue={org.activities?.join(", ") ?? ""}
              placeholder="Construcción, Salud, IT"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Zona objetivo (separadas por coma)</label>
            <input
              name="zonaObjetivo"
              defaultValue={org.zonaObjetivo?.join(", ") ?? ""}
              placeholder="CABA, Buenos Aires, Córdoba"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium">Excluir palabras (separadas por coma)</label>
            <input
              name="excludedKeywords"
              defaultValue={org.excludedKeywords?.join(", ") ?? ""}
              placeholder="obra, vialidad, catering"
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-brand">Capacidad operativa</h2>
        <p className="text-sm text-neutral-500">Estimaciones aproximadas — alimentan tu afinidad.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">Facturación anual (millones ARS)</label>
            <select
              name="facturacionRango"
              defaultValue={org.facturacionRango ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              <option value="">Elegir…</option>
              {FACTURACION_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Cantidad de empleados</label>
            <select
              name="empleadosRango"
              defaultValue={org.empleadosRango ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            >
              <option value="">Elegir…</option>
              {EMPLEADOS_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-6">
        <h2 className="font-semibold text-brand">Montos & pagos</h2>
        <p className="text-sm text-neutral-500">Rango de licitación que evaluás y modalidades de pago aceptadas.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium">Monto mínimo de interés (ARS)</label>
            <input
              type="number"
              name="montoMinimo"
              defaultValue={org.montoMinimo ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Monto máximo de interés (ARS)</label>
            <input
              type="number"
              name="montoMaximo"
              defaultValue={org.montoMaximo ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Monto máximo típico (ARS)</label>
            <input
              type="number"
              name="montoMaximoTipico"
              defaultValue={org.montoMaximoTipico ?? ""}
              className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium">Términos de pago aceptados</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {TERMINOS_PAGO_OPTIONS.map((t) => (
              <label key={t} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="terminosPagoAceptados"
                  value={t}
                  defaultChecked={org.terminosPagoAceptados?.includes(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 max-w-xs">
          <label className="block text-sm font-medium">Días de pago (plazo máximo tolerado)</label>
          <input
            type="number"
            name="diasPagoMaximo"
            defaultValue={org.diasPagoMaximo ?? 60}
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2"
          />
        </div>
      </section>

      <button
        type="submit"
        className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
      >
        {submitLabel}
      </button>
    </form>
  );
}
