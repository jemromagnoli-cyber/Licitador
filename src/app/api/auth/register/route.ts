import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { organizations, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSessionCookie } from "@/lib/auth/session";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  companyName: z.string().min(2),
  displayName: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos" }, { status: 400 });
  }

  const { email, password, companyName, displayName } = parsed.data;

  const existing = await db.query.users.findFirst({ where: (f, { eq }) => eq(f.email, email) });
  if (existing) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
  }

  const [org] = await db.insert(organizations).values({ name: companyName }).returning();

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      displayName: displayName ?? email.split("@")[0],
      organizationId: org!.id,
      role: "owner",
    })
    .returning();

  await createSessionCookie(user!.id);

  return NextResponse.json({ ok: true });
}
