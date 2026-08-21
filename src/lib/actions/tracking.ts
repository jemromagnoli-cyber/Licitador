"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tenderTracking } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";

const VALID_STAGES = [
  "nueva",
  "en_analisis",
  "guardada",
  "descartada",
  "en_preparacion",
  "presentada",
  "ganada",
  "perdida",
] as const;

export async function setTrackingStage(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");

  const tenderId = formData.get("tenderId") as string;
  const stage = formData.get("stage") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/app/oportunidades";

  if (!tenderId || !VALID_STAGES.includes(stage as (typeof VALID_STAGES)[number])) {
    return;
  }

  const existing = await db.query.tenderTracking.findFirst({
    where: (f, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(f.organizationId, user!.organizationId!), eqOp(f.tenderId, tenderId)),
  });

  if (existing) {
    await db
      .update(tenderTracking)
      .set({ stage: stage as (typeof VALID_STAGES)[number], userId: user!.id, updatedAt: new Date() })
      .where(eq(tenderTracking.id, existing.id));
  } else {
    await db.insert(tenderTracking).values({
      organizationId: user!.organizationId!,
      tenderId,
      userId: user!.id,
      stage: stage as (typeof VALID_STAGES)[number],
    });
  }

  revalidatePath("/app/oportunidades");
  revalidatePath("/app/pipeline");
  redirect(redirectTo);
}

export async function removeTracking(formData: FormData) {
  const user = await getCurrentUser();
  if (!user?.organizationId) redirect("/login");

  const tenderId = formData.get("tenderId") as string;
  if (!tenderId) return;

  await db
    .delete(tenderTracking)
    .where(
      and(eq(tenderTracking.organizationId, user!.organizationId!), eq(tenderTracking.tenderId, tenderId)),
    );

  revalidatePath("/app/oportunidades");
  revalidatePath("/app/pipeline");
}
