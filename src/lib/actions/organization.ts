"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { organizations } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

function splitList(raw: FormDataEntryValue | null): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function numOrUndefined(raw: FormDataEntryValue | null): number | undefined {
  if (!raw || typeof raw !== "string" || raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function computeCompleteness(fields: Record<string, unknown>): number {
  const values = Object.values(fields);
  const filled = values.filter((v) => {
    if (Array.isArray(v)) return v.length > 0;
    return v !== undefined && v !== null && v !== "";
  }).length;
  return Math.round((filled / values.length) * 100);
}

export async function updateOrganizationProfile(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    redirect("/login");
  }

  const cuit = (formData.get("cuit") as string) || undefined;
  const razonSocial = (formData.get("razonSocial") as string) || undefined;
  const activities = splitList(formData.get("activities"));
  const zonaObjetivo = splitList(formData.get("zonaObjetivo"));
  const excludedKeywords = splitList(formData.get("excludedKeywords"));
  const facturacionRango = (formData.get("facturacionRango") as string) || undefined;
  const empleadosRango = (formData.get("empleadosRango") as string) || undefined;
  const montoMinimo = numOrUndefined(formData.get("montoMinimo"));
  const montoMaximo = numOrUndefined(formData.get("montoMaximo"));
  const montoMaximoTipico = numOrUndefined(formData.get("montoMaximoTipico"));
  const diasPagoMaximo = numOrUndefined(formData.get("diasPagoMaximo"));
  const terminosPagoAceptados = formData.getAll("terminosPagoAceptados") as string[];

  const completeness = computeCompleteness({
    cuit,
    razonSocial,
    activities,
    zonaObjetivo,
    facturacionRango,
    empleadosRango,
    montoMinimo,
    montoMaximo,
    terminosPagoAceptados,
  });

  await db
    .update(organizations)
    .set({
      cuit,
      razonSocial,
      activities,
      zonaObjetivo,
      excludedKeywords,
      facturacionRango,
      empleadosRango,
      montoMinimo,
      montoMaximo,
      montoMaximoTipico,
      diasPagoMaximo,
      terminosPagoAceptados,
      onboardingCompleted: true,
      profileCompleteness: completeness,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, user!.organizationId!));

  revalidatePath("/app");
  redirect("/app/oportunidades");
}
