/**
 * Toda la marca del producto vive acá. Para renombrar el proyecto, cambiá
 * este archivo (y NEXT_PUBLIC_BRAND_NAME en .env si querés que el nombre
 * también se pueda overridear sin rebuild).
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "Licitador",
  tagline: "Todas las licitaciones públicas de Argentina, en un solo lugar.",
  supportEmail: "contacto@licitador.example",
} as const;
