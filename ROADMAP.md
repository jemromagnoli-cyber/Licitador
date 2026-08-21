# Roadmap

Basado en lo que construimos hoy + lo que relevamos explorando licit.ar
(incluyendo el dashboard real, con permiso del dueño de la cuenta). Orden
sugerido, no obligatorio.

## Fase 1 — Hecho ✅

- Motor de ingesta con arquitectura de conectores (demo + 2 conectores
  reales listos para activar).
- Base de datos y modelo de datos completo.
- Fit Score determinista.
- Sitio público + auth + onboarding + dashboard de oportunidades + pipeline.

## Fase 2 — Confirmar fuentes de datos reales

- [ ] Confirmar URL del endpoint OCDS de Buenos Aires Compras
      (`BAC_OCDS_URL`). Página de referencia:
      https://data.buenosaires.gob.ar/dataset/buenos-aires-compras
- [ ] Confirmar dataset id + columnas del CSV de CONTRAT.AR en datos.gob.ar
      (`CONTRATAR_DATASET_ID`).
- [ ] Sumar más fuentes: portales provinciales (empezar por las que tengan
      datos abiertos / API en vez de HTML — mucho menos frágil que
      scrapear). COMPR.AR (nacional, bienes y servicios) tiene protección
      anti-bot fuerte (devuelve 403 a requests no-browser) — si hace falta
      esa fuente puntual, evaluar un scraper con browser headless real
      (Playwright) respetando rate limits, en vez de fetch directo.
- [ ] Programar la ingesta como cron job (Railway cron, por ejemplo cada
      2-6 horas) llamando a `npm run ingest`.

## Fase 3 — Resumen y checklist con IA

Esto es lo que en licit.ar es el diferencial principal: leer el pliego
(PDF) y generar resumen ejecutivo + checklist con un LLM.

- [ ] Job que descargue el/los PDF de una licitación (cuando la fuente los
      linkee) y extraiga texto (ej. `pdf-parse` o similar).
- [ ] Prompt + llamada a un LLM (guardar el resultado en
      `tenders.summary` / `tenders.checklist`, campos que ya existen en el
      schema).
- [ ] Mostrar el resultado en la ficha de licitación, con aviso de que es
      orientativo y no asesoramiento legal (igual que hace licit.ar en su
      página `/legal/ai`).
- [ ] Asistente conversacional (chat) sobre una licitación puntual, con
      límite de mensajes por hora para controlar costo.

## Fase 4 — Alertas y notificaciones

- [ ] Alertas por email cuando aparece una oportunidad de alta afinidad o
      se acerca un cierre (reglas configurables, como en
      Configuración → Alertas del producto de referencia).
- [ ] Notificaciones por WhatsApp (vía alguna API de WhatsApp Business).
- [ ] Reporte semanal por email.

## Fase 5 — Planes pagos / facturación

- [ ] Integrar Mercado Pago (suscripciones) — es el medio de pago que usa
      el producto de referencia para el mercado argentino.
- [ ] Wizard de checkout: elegir plan → datos de facturación → confirmar.
- [ ] Facturación electrónica AFIP (Factura A/B).
- [ ] Paywall real: limitar cuántas licitaciones puede ver por día una
      cuenta en trial (el producto de referencia usa "5 fichas por día" en
      la vista gratuita).

## Fase 6 — Colaboración y cuentas de equipo

- [ ] Invitar usuarios a la organización, roles (owner/admin/member).
- [ ] Comentarios y asignación de responsable por oportunidad.
- [ ] Multi-CUIT por cuenta (para estudios/consultoras que gestionan
      varias empresas).

## Fase 7 — Plataforma

- [ ] API REST pública + webhooks para integrar con CRM/ERP.
- [ ] Exportar datos (Ley 25.326 — derecho de portabilidad).
- [ ] Historización: guardar versiones de una licitación cuando cambia
      (fecha de cierre, monto, etc.) para poder mostrar "esto se modificó".
