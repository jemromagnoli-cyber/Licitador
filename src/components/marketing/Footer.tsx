import Link from "next/link";
import { BRAND } from "@/lib/branding";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-black/10 py-10 text-sm text-neutral-500">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {BRAND.name}. Datos de licitaciones públicas de fuentes
          oficiales de Argentina.
        </p>
        <div className="flex gap-4">
          <Link href="/precios" className="hover:text-brand">
            Precios
          </Link>
          <Link href="/cobertura" className="hover:text-brand">
            Cobertura
          </Link>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-brand">
            Contacto
          </a>
        </div>
      </div>
    </footer>
  );
}
