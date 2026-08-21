import Link from "next/link";
import { BRAND } from "@/lib/branding";
import { getCurrentUser } from "@/lib/auth/session";

export async function Navbar() {
  const user = await getCurrentUser();

  return (
    <header className="border-b border-black/10">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand">
          <span className="inline-block h-6 w-6 rounded bg-brand" aria-hidden />
          {BRAND.name}
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium text-neutral-700 md:flex">
          <Link href="/#producto" className="hover:text-brand">
            Producto
          </Link>
          <Link href="/cobertura" className="hover:text-brand">
            Cobertura
          </Link>
          <Link href="/precios" className="hover:text-brand">
            Precios
          </Link>
        </div>

        {user ? (
          <Link
            href="/app/oportunidades"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Ir a la app →
          </Link>
        ) : (
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-semibold text-brand hover:underline">
              Iniciar sesión
            </Link>
            <Link
              href="/registro"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Crear cuenta
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
