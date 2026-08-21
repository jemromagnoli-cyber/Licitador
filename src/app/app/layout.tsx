import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/app/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-1">
      <Sidebar orgName={user.organization?.name ?? "Sin empresa"} planKey={user.organization?.planKey ?? "trial"} />
      <div className="flex-1 overflow-y-auto bg-neutral-50">{children}</div>
    </div>
  );
}
