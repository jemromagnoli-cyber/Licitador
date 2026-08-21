import { getCurrentUser } from "@/lib/auth/session";
import { OrganizationProfileForm } from "@/components/app/OrganizationProfileForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">Bienvenido</p>
      <h1 className="mt-1 text-3xl font-extrabold text-brand">Configurá tu empresa en 3 minutos</h1>
      <p className="mt-2 text-neutral-600">
        Te vamos a hacer algunas preguntas para entender qué licitaciones realmente importan
        para vos. Cuanto más completo esté tu perfil, mejor el matching.
      </p>

      <div className="mt-8">
        <OrganizationProfileForm org={user?.organization ?? {}} submitLabel="Guardar y entrar →" />
      </div>
    </div>
  );
}
