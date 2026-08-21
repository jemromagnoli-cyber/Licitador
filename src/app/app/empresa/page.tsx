import { getCurrentUser } from "@/lib/auth/session";
import { OrganizationProfileForm } from "@/components/app/OrganizationProfileForm";

export default async function EmpresaPage() {
  const user = await getCurrentUser();
  const org = user?.organization;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold text-brand">Perfil de empresa</h1>
      <p className="mt-1 text-neutral-600">
        Este perfil define tu puntaje de afinidad y qué oportunidades te mostramos primero.
      </p>

      {org && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-black/10 bg-white p-4">
          <div className="text-2xl font-extrabold text-brand">{org.profileCompleteness}%</div>
          <div>
            <p className="font-semibold">Tu perfil está al {org.profileCompleteness}%</p>
            <p className="text-sm text-neutral-500">Completá más campos para mejorar tu afinidad.</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <OrganizationProfileForm org={org ?? {}} submitLabel="Guardar perfil" />
      </div>
    </div>
  );
}
