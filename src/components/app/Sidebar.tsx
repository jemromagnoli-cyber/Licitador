import Link from "next/link";
import { BRAND } from "@/lib/branding";

const LINKS = [
  { href: "/app/oportunidades", label: "Oportunidades" },
  { href: "/app/pipeline", label: "Mis licitaciones" },
  { href: "/app/empresa", label: "Perfil de empresa" },
];

export function Sidebar({ orgName, planKey }: { orgName: string; planKey: string }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-black/10 bg-brand-dark text-white">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-lg font-bold">{BRAND.name}</p>
      </div>

      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-xs uppercase tracking-wide text-white/50">Empresa</p>
        <p className="mt-1 truncate font-semibold">{orgName}</p>
        <p className="text-xs text-white/50">Plan: {planKey}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <form action="/api/auth/logout" method="POST" className="px-3 pb-4">
        <button
          type="submit"
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white"
        >
          Cerrar sesión
        </button>
      </form>
    </aside>
  );
}
