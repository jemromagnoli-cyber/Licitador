import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  bigint,
  numeric,
  timestamp,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const jurisdictionTypeEnum = pgEnum("jurisdiction_type", [
  "nacional",
  "provincial",
  "municipal",
  "empresa_publica",
  "empresa_privada",
]);

export const tenderStatusEnum = pgEnum("tender_status", [
  "publicada",
  "en_consulta",
  "abierta",
  "adjudicada",
  "desierta",
  "cancelada",
  "cerrada",
]);

export const ingestStatusEnum = pgEnum("ingest_status", [
  "success",
  "partial",
  "error",
]);

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "member"]);

export const trackingStageEnum = pgEnum("tracking_stage", [
  "nueva",
  "en_analisis",
  "guardada",
  "descartada",
  "en_preparacion",
  "presentada",
  "ganada",
  "perdida",
]);

// ---------------------------------------------------------------------------
// Sources: one row per data source / connector (COMPR.AR, BAC, CONTRAT.AR...)
// ---------------------------------------------------------------------------

export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(), // e.g. "demo", "bac-ocds", "contratar-ckan"
  name: text("name").notNull(), // e.g. "Buenos Aires Compras (BAC)"
  jurisdictionType: jurisdictionTypeEnum("jurisdiction_type").notNull(),
  jurisdictionName: text("jurisdiction_name").notNull(), // e.g. "CABA", "Nación", "Córdoba"
  baseUrl: text("base_url"),
  connectorKey: varchar("connector_key", { length: 64 }).notNull(), // maps to lib/connectors registry
  active: boolean("active").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Organizations (empresas) + matching profile
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  cuit: varchar("cuit", { length: 13 }), // formatted NN-NNNNNNNN-N
  razonSocial: text("razon_social"),
  afipVerified: boolean("afip_verified").notNull().default(false),

  // Perfil de matching
  activities: text("activities").array().notNull().default([]), // rubros / actividades comerciales
  excludedKeywords: text("excluded_keywords").array().notNull().default([]),
  zonaObjetivo: text("zona_objetivo").array().notNull().default([]), // provincias / CABA

  // Capacidad operativa
  facturacionRango: varchar("facturacion_rango", { length: 16 }), // "<50" | "50-200" | "200-1000" | "1000-5000" | ">5000"
  empleadosRango: varchar("empleados_rango", { length: 16 }), // "1-10" | "11-50" | "51-250" | "251-1000" | ">1000"

  // Montos & pagos
  montoMinimo: bigint("monto_minimo", { mode: "number" }),
  montoMaximo: bigint("monto_maximo", { mode: "number" }),
  montoMaximoTipico: bigint("monto_maximo_tipico", { mode: "number" }),
  terminosPagoAceptados: text("terminos_pago_aceptados").array().notNull().default([]),
  diasPagoMaximo: integer("dias_pago_maximo").default(60),

  planKey: varchar("plan_key", { length: 32 }).notNull().default("trial"), // trial | starter | pro | enterprise
  onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
  profileCompleteness: integer("profile_completeness").notNull().default(0), // 0-100, computed

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  organizationId: uuid("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  role: userRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Tenders (licitaciones) — normalized, source-agnostic
// ---------------------------------------------------------------------------

export const tenders = pgTable(
  "tenders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(), // id/expediente in the origin system

    title: text("title").notNull(),
    organismo: text("organismo").notNull(),
    jurisdiction: text("jurisdiction").notNull(), // e.g. "Tierra del Fuego", "CABA", "Nación"
    category: text("category"), // rubro
    procedureType: text("procedure_type"), // licitación pública / contratación directa / etc.
    status: tenderStatusEnum("status").notNull().default("publicada"),

    publishedAt: timestamp("published_at", { withTimezone: true }),
    closingAt: timestamp("closing_at", { withTimezone: true }),

    // numeric, no bigint: los montos reales de fuentes como BAC vienen con
    // centavos (ej. 2026999.98) — bigint solo acepta enteros y esto hacía
    // fallar el insert con un error de Postgres. precision 18/scale 2 deja
    // margen amplio para montos grandes (obra pública, etc).
    amount: numeric("amount", { precision: 18, scale: 2, mode: "number" }),
    currency: varchar("currency", { length: 8 }).default("ARS"),

    url: text("url"), // link to the original tender on the source portal
    summary: text("summary"), // AI-generated executive summary (phase 2)
    checklist: jsonb("checklist"), // AI-generated checklist (phase 2)

    raw: jsonb("raw"), // original payload from the connector, for audit/debug

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tenders_source_external_unique").on(table.sourceId, table.externalId),
    index("tenders_closing_at_idx").on(table.closingAt),
    index("tenders_jurisdiction_idx").on(table.jurisdiction),
    index("tenders_category_idx").on(table.category),
  ],
);

// ---------------------------------------------------------------------------
// Tender tracking (per-organization pipeline / saved / discarded)
// ---------------------------------------------------------------------------

export const tenderTracking = pgTable(
  "tender_tracking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    tenderId: uuid("tender_id")
      .notNull()
      .references(() => tenders.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    stage: trackingStageEnum("stage").notNull().default("nueva"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tracking_org_tender_unique").on(table.organizationId, table.tenderId),
  ],
);

// ---------------------------------------------------------------------------
// Ingest runs (observability for the data engine)
// ---------------------------------------------------------------------------

export const ingestRuns = pgTable("ingest_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceId: uuid("source_id")
    .notNull()
    .references(() => sources.id, { onDelete: "cascade" }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  status: ingestStatusEnum("status"),
  itemsFound: integer("items_found").notNull().default(0),
  itemsCreated: integer("items_created").notNull().default(0),
  itemsUpdated: integer("items_updated").notNull().default(0),
  errorMessage: text("error_message"),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  tracking: many(tenderTracking),
}));

export const usersRelations = relations(users, ({ one }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  tenders: many(tenders),
  runs: many(ingestRuns),
}));

export const tendersRelations = relations(tenders, ({ one, many }) => ({
  source: one(sources, { fields: [tenders.sourceId], references: [sources.id] }),
  tracking: many(tenderTracking),
}));

export const tenderTrackingRelations = relations(tenderTracking, ({ one }) => ({
  organization: one(organizations, {
    fields: [tenderTracking.organizationId],
    references: [organizations.id],
  }),
  tender: one(tenders, { fields: [tenderTracking.tenderId], references: [tenders.id] }),
  user: one(users, { fields: [tenderTracking.userId], references: [users.id] }),
}));

export const ingestRunsRelations = relations(ingestRuns, ({ one }) => ({
  source: one(sources, { fields: [ingestRuns.sourceId], references: [sources.id] }),
}));
