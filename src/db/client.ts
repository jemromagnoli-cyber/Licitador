import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definida. Copiá .env.example a .env y configurá tu conexión a Postgres.",
  );
}

// A single shared connection pool for the whole app (Next.js reuses modules
// across requests in the same process during dev, so we guard against
// creating a new pool on every hot-reload).
const globalForDb = globalThis as unknown as {
  _licitadorClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb._licitadorClient ??
  postgres(connectionString, { max: 10, prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb._licitadorClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;
