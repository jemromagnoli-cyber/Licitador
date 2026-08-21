# Licitador

Portal que centraliza licitaciones públicas de Argentina y calcula un
puntaje de afinidad por empresa. Construido como alternativa propia a
[licit.ar](https://licit.ar).

> **Nombre placeholder**: "Licitador" es un nombre temporal. Para renombrar
> el proyecto, editá `src/lib/branding.ts` (y opcionalmente
> `NEXT_PUBLIC_BRAND_NAME` en `.env`).

## Qué incluye esta primera versión

- **Motor de ingesta** (`src/lib/connectors/`, `src/lib/ingest/`): arquitectura
  de conectores (`TenderSource`) que normaliza licitaciones desde cualquier
  fuente y las guarda en Postgres con deduplicación y logging por corrida
  (tabla `ingest_runs`).
  - `demo.ts`: genera ~90 licitaciones sintéticas pero realistas (organismos,
    jurisdicciones y vocabulario reales) para que todo el producto funcione
    de punta a punta sin depender de un portal externo.
  - `ocds.ts` + `bac-ocds.ts`: parser genérico del estándar internacional
    **OCDS** (Open Contracting Data Standard) y conector listo para Buenos
    Aires Compras (CABA). Falta confirmar la URL exacta del endpoint — ver
    comentario en el archivo.
  - `ckan.ts` + `contratar-ckan.ts`: cliente genérico de portales **CKAN**
    (el software detrás de datos.gob.ar) y conector para el dataset de
    CONTRAT.AR (obra pública nacional). Falta confirmar el dataset id y las
    columnas exactas del CSV publicado — ver comentario en el archivo.
- **Base de datos** (`src/db/schema.ts`, Drizzle ORM + Postgres): `sources`,
  `tenders`, `organizations`, `users`, `tender_tracking`, `ingest_runs`.
- **Fit Score determinista** (`src/lib/scoring/fit-score.ts`): puntaje 0-100
  explicable (no usa IA) según rubro, zona, montos y palabras excluidas del
  perfil de la empresa — igual que describe licit.ar en su página de
  transparencia de IA.
- **Sitio público**: home, precios, cobertura (lee las fuentes reales de la
  base), login y registro.
- **App autenticada** (`/app`): onboarding de perfil de empresa, listado de
  oportunidades con filtros y puntaje de afinidad, ficha de licitación,
  pipeline de seguimiento (guardar / descartar / agregar / cambiar de
  etapa).
- **Auth propio**: cookies firmadas (JWT con `jose`), contraseñas con
  `bcryptjs`. No depende de ningún proveedor externo.

## Qué NO incluye todavía (fase 2)

Ver `ROADMAP.md` para el detalle. En resumen: resumen de pliegos y checklist
con IA, alertas por email/WhatsApp, facturación/planes pagos, más fuentes de
datos reales, multi-usuario por empresa, API pública.

## Cómo correrlo localmente

Requisitos: Node 20+, Postgres.

```bash
cp .env.example .env        # completar DATABASE_URL y AUTH_SECRET
npm install
npm run db:generate         # genera la migración (ya versionada en el repo)
npm run db:migrate          # aplica el esquema a tu Postgres
npm run db:seed             # crea las filas de "sources"
npm run ingest -- demo      # carga ~90 licitaciones de demo
npm run dev                 # http://localhost:3000
```

Para correr **todas** las fuentes activas (por defecto solo "demo" está
activa): `npm run ingest`.

## Activar una fuente real

1. Completar la variable de entorno que pide el conector (ver comentarios en
   `src/lib/connectors/bac-ocds.ts` y `contratar-ckan.ts`).
2. Marcar la fuente como activa: `UPDATE sources SET active = true WHERE key = '...'`.
3. Correr `npm run ingest -- <key>` y revisar la tabla `ingest_runs` (o los
   logs) para confirmar que se están mapeando bien los campos.

## Desplegar

Pensado para desplegarse en Railway (Postgres + servicio web Next.js + un
cron/scheduled job separado que corra `npm run ingest` periódicamente). El
entorno de desarrollo de este proyecto tenía una allowlist de red muy
restrictiva que bloqueó pruebas en vivo contra `datos.gob.ar` y
`data.buenosaires.gob.ar` (error 403) — en Railway, sin esa restricción, hay
que volver a probar los conectores reales contra los endpoints en vivo.
