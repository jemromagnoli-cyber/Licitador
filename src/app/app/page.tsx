import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AppIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!user.organization?.onboardingCompleted) {
    redirect("/app/onboarding");
  }

  redirect("/app/oportunidades");
}
