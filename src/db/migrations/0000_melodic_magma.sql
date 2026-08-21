CREATE TYPE "public"."ingest_status" AS ENUM('success', 'partial', 'error');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_type" AS ENUM('nacional', 'provincial', 'municipal', 'empresa_publica', 'empresa_privada');--> statement-breakpoint
CREATE TYPE "public"."tender_status" AS ENUM('publicada', 'en_consulta', 'abierta', 'adjudicada', 'desierta', 'cancelada', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."tracking_stage" AS ENUM('nueva', 'en_analisis', 'guardada', 'descartada', 'en_preparacion', 'presentada', 'ganada', 'perdida');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" "ingest_status",
	"items_found" integer DEFAULT 0 NOT NULL,
	"items_created" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cuit" varchar(13),
	"razon_social" text,
	"afip_verified" boolean DEFAULT false NOT NULL,
	"activities" text[] DEFAULT '{}' NOT NULL,
	"excluded_keywords" text[] DEFAULT '{}' NOT NULL,
	"zona_objetivo" text[] DEFAULT '{}' NOT NULL,
	"facturacion_rango" varchar(16),
	"empleados_rango" varchar(16),
	"monto_minimo" bigint,
	"monto_maximo" bigint,
	"monto_maximo_tipico" bigint,
	"terminos_pago_aceptados" text[] DEFAULT '{}' NOT NULL,
	"dias_pago_maximo" integer DEFAULT 60,
	"plan_key" varchar(32) DEFAULT 'trial' NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"profile_completeness" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"jurisdiction_type" "jurisdiction_type" NOT NULL,
	"jurisdiction_name" text NOT NULL,
	"base_url" text,
	"connector_key" varchar(64) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "tender_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tender_id" uuid NOT NULL,
	"user_id" uuid,
	"stage" "tracking_stage" DEFAULT 'nueva' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"organismo" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"category" text,
	"procedure_type" text,
	"status" "tender_status" DEFAULT 'publicada' NOT NULL,
	"published_at" timestamp with time zone,
	"closing_at" timestamp with time zone,
	"amount" bigint,
	"currency" varchar(8) DEFAULT 'ARS',
	"url" text,
	"summary" text,
	"checklist" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"organization_id" uuid,
	"role" "user_role" DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ingest_runs" ADD CONSTRAINT "ingest_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tracking" ADD CONSTRAINT "tender_tracking_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tracking" ADD CONSTRAINT "tender_tracking_tender_id_tenders_id_fk" FOREIGN KEY ("tender_id") REFERENCES "public"."tenders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tender_tracking" ADD CONSTRAINT "tender_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenders" ADD CONSTRAINT "tenders_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tracking_org_tender_unique" ON "tender_tracking" USING btree ("organization_id","tender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tenders_source_external_unique" ON "tenders" USING btree ("source_id","external_id");--> statement-breakpoint
CREATE INDEX "tenders_closing_at_idx" ON "tenders" USING btree ("closing_at");--> statement-breakpoint
CREATE INDEX "tenders_jurisdiction_idx" ON "tenders" USING btree ("jurisdiction");--> statement-breakpoint
CREATE INDEX "tenders_category_idx" ON "tenders" USING btree ("category");