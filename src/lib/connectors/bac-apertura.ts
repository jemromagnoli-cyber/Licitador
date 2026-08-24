import { chromium } from "playwright";
import type { NormalizedTender, TenderSource, TenderSourceResult } from "./types";

/**
 * Conector real: Buenos Aires Compras (BAC) — procesos "En Apertura" (los
 * que están vigentes/abiertos AHORA), leídos directamente del buscador
 * avanzado del propio portal:
 *
 *   https://www.buenosairescompras.gob.ar/BuscarAvanzado.aspx
 *   → Estado proceso: "En Apertura"
 *
 * Reemplaza a bac-anual.ts: ese conector usaba el recurso CSV "Anual" del
 * portal de datos abiertos, que resultó ser un archivo histórico que se
 * actualiza con poca frecuencia — probado en producción, el 100% de los
 * ~25.000 procesos que contenía ya tenían fecha de cierre vencida, incluso
 * marcados como "activos". El buscador de BuscarAvanzado.aspx en cambio es
 * el mismo que usa cualquier persona en el sitio de BAC para ver qué hay
 * publicado ahora, así que es la fuente correcta para "solo lo que está
 * abierto ahora mismo".
 *
 * POR QUÉ ESTE CONECTOR USA UN NAVEGADOR (Playwright) EN VEZ DE fetch/https:
 * La primera versión reproducía el formulario de ASP.NET WebForms a mano
 * (GET para conseguir cookies + __VIEWSTATE, POST simulando el click en
 * "Buscar", POST paginado con __doPostBack). Probado en producción: el GET
 * siempre funcionaba, pero el POST de búsqueda volvía redirigido (302) a
 * Default.aspx — es decir, 0 resultados — incluso reproduciendo exactamente
 * los mismos campos del formulario, las mismas cookies de sesión y headers
 * de navegador real (User-Agent de Chrome, Sec-Fetch-*, sec-ch-ua). Se
 * confirmó a mano con un navegador real (Claude in Chrome) que ese mismo
 * POST, desde una sesión de navegador real, SÍ funciona y devuelve
 * resultados (712 procesos "En Apertura" al momento de probarlo) — así que
 * no es que "todo POST esté bloqueado", sino algo específico de cómo se ve
 * la conexión (posiblemente el fingerprint TLS/HTTP2 de Node, o reputación
 * de la IP del datacenter para pedidos que "mutan" vs. los de solo lectura)
 * que un simple cambio de headers no alcanza a resolver. Por eso este
 * conector usa Playwright para manejar un Chromium real sin interfaz
 * (headless): abre la página, completa el filtro "Estado proceso = En
 * Apertura" y hace click en "Buscar" tal como lo haría una persona.
 *
 * IMPORTANTE sobre "Fecha de apertura": empíricamente se observó que BAC
 * a veces deja procesos marcados "En Apertura" con una fecha de apertura
 * ya vencida (ej: un proceso de 2022 que sigue figurando "En Apertura" en
 * el buscador en 2026) — es un estado administrativo, no una garantía de
 * que la fecha nominal siga vigente. Por eso acá NO se usa esa fecha para
 * filtrar: se confía en que el propio buscador de BAC, filtrado por
 * Estado=En Apertura, ya es la señal de "abierto ahora". La fecha se
 * guarda como `closingAt` solamente cuando todavía está en el futuro (así
 * se sigue mostrando "Cierre: ..." en la UI cuando es un dato útil), pero
 * si ya pasó se omite para no pisar el filtro de relevancia
 * (isTenderStillOpen en src/lib/tenders/relevance.ts) y terminar
 * ocultando procesos que BAC mismo considera vigentes.
 */

const BASE_URL = "https://www.buenosairescompras.gob.ar/BuscarAvanzado.aspx";
const DEFAULT_JURISDICTION = "CABA";
const PAGE_SIZE = 10;
const ESTADO_EN_APERTURA = "13";
const NAV_TIMEOUT_MS = 30_000;
// Salvaguarda: si algo sale mal y la paginación no corta, no seguir para
// siempre. 400 páginas = 4000 procesos, muy por encima de lo esperado.
const MAX_PAGES = 400;

const SEL_ESTADO_PROCESO = "#ctl00_CPH1_ddlEstadoProceso";
const SEL_BOTON_BUSCAR = "#ctl00_CPH1_btnListarPliegoAvanzado";

interface BacRow {
  numeroProceso: string;
  nombreProceso: string;
  tipoProceso: string;
  fechaAperturaRaw: string;
  estado: string;
  unidadEjecutora: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function cleanCell(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function extractTotalCount(html: string): number {
  const idx = html.indexOf("encontrado");
  if (idx === -1) return 0;
  const windowText = html.slice(idx, idx + 200).replace(/<[^>]+>/g, "");
  const m = windowText.match(/(\d+)/);
  return m ? Number.parseInt(m[1], 10) : 0;
}

/** Extrae las filas de datos (exactamente 6 <td>) de la tabla de resultados. */
function extractDataRows(html: string): BacRow[] {
  const rows: BacRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const tdMatches = Array.from(rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g));
    if (tdMatches.length !== 6) continue; // descarta encabezado y filas de paginado
    const cells = tdMatches.map((m) => cleanCell(m[1]));
    const [numeroProceso, nombreProceso, tipoProceso, fechaAperturaRaw, estado, unidadEjecutora] = cells;
    if (!numeroProceso) continue;
    rows.push({ numeroProceso, nombreProceso, tipoProceso, fechaAperturaRaw, estado, unidadEjecutora });
  }
  return rows;
}

function parseFechaApertura(raw: string): Date | undefined {
  const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!m) return undefined;
  const [, dd, mm, yyyy, hh, min] = m;
  // Hora de Argentina (UTC-3), igual que en los otros conectores de BAC.
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function rowToTender(row: BacRow): NormalizedTender {
  const fechaApertura = parseFechaApertura(row.fechaAperturaRaw);
  const now = new Date();
  // Ver comentario grande al inicio del archivo: solo usamos la fecha como
  // closingAt cuando todavía está en el futuro.
  const closingAt = fechaApertura && fechaApertura.getTime() > now.getTime() ? fechaApertura : undefined;

  return {
    externalId: row.numeroProceso,
    title: row.nombreProceso || row.numeroProceso,
    organismo: row.unidadEjecutora || "Organismo no informado",
    jurisdiction: DEFAULT_JURISDICTION,
    procedureType: row.tipoProceso || undefined,
    // Este conector solo trae procesos que BAC clasifica como "En
    // Apertura" (Estado proceso=13 en la búsqueda) — por construcción,
    // todo lo que llega acá está vigente.
    status: "abierta",
    closingAt,
    currency: "ARS",
    raw: row,
  };
}

/**
 * Espera "lo mejor que se puede" a que termine una navegación/postback de
 * ASP.NET: no sabemos de antemano si el click dispara una navegación de
 * página completa o una actualización parcial (AJAX), así que probamos
 * networkidle con timeout corto (no aborta el flujo si no llega a estar
 * idle) más una espera fija chica, para cubrir ambos casos.
 */
async function esperarPostback(page: import("playwright").Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT_MS }).catch(() => {});
  await page.waitForTimeout(500);
}

export function createBacAperturaSource(): TenderSource {
  return {
    key: "bac-apertura",
    label: "Buenos Aires Compras (BAC) — procesos en apertura (vigentes)",
    async fetchTenders(): Promise<TenderSourceResult> {
      const warnings: string[] = [];

      const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });

      try {
        const page = await browser.newPage({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
          locale: "es-AR",
        });
        page.setDefaultTimeout(NAV_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

        try {
          await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS });
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(`No se pudo abrir la búsqueda avanzada de BAC (${BASE_URL}) con el navegador: ${cause}`);
        }

        // Igual que en la versión anterior (fetch): la primera visita "en
        // frío" puede rebotar a otra página (bootstrap de sesión del WAF).
        // Si no aparece el select de Estado proceso, reintentamos una vez.
        let hasForm = (await page.locator(SEL_ESTADO_PROCESO).count()) > 0;
        if (!hasForm) {
          warnings.push(
            `Primera visita a BAC no mostró el formulario de búsqueda (URL final: ${page.url()}) — reintentando una vez.`,
          );
          await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT_MS }).catch(() => {});
          hasForm = (await page.locator(SEL_ESTADO_PROCESO).count()) > 0;
        }

        if (!hasForm) {
          const snippet = (await page.content()).replace(/\s+/g, " ").trim().slice(0, 400);
          throw new Error(
            `BAC no mostró el formulario de búsqueda avanzada después de 2 intentos (URL final: ${page.url()}). Primeros 400 chars: "${snippet}"`,
          );
        }

        await page.selectOption(SEL_ESTADO_PROCESO, ESTADO_EN_APERTURA);

        try {
          await page.click(SEL_BOTON_BUSCAR);
          await esperarPostback(page);
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(`Falló el click en "Buscar" (Estado proceso = En Apertura) en BAC: ${cause}`);
        }

        let html = await page.content();
        const totalCount = extractTotalCount(html);
        const firstPageRows = extractDataRows(html);

        if (totalCount === 0 && firstPageRows.length === 0) {
          const hasGrid = html.includes("GridListaPliegos");
          const hasEncontrado = html.includes("encontrado");
          const snippet = html.replace(/\s+/g, " ").trim().slice(0, 400);
          return {
            tenders: [],
            warnings: [
              `BAC devolvió 0 procesos "En Apertura" tras buscar con el navegador — URL final: ${page.url()}, ¿tiene tabla de grilla?: ${hasGrid}, ¿tiene texto "encontrado"?: ${hasEncontrado}. Primeros 400 chars: "${snippet}"`,
            ],
          };
        }

        const allRows: BacRow[] = [...firstPageRows];
        const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE) || 1, MAX_PAGES);

        for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
          try {
            await page.evaluate(
              ([target, arg]) => {
                const doPostBack = (
                  window as unknown as { __doPostBack?: (t: string, a: string) => void }
                ).__doPostBack;
                if (doPostBack) doPostBack(target, arg);
              },
              ["ctl00$CPH1$GridListaPliegos", `Page$${pageNum}`],
            );
          } catch {
            // Es esperable que evaluate a veces "falle" si el postback
            // dispara una navegación completa (el contexto de ejecución se
            // destruye a mitad de camino) — no es un error real, seguimos
            // igual a esperar que la página termine de cargar.
          }
          await esperarPostback(page);

          html = await page.content();
          const rows = extractDataRows(html);
          if (rows.length === 0) {
            warnings.push(`Página ${pageNum}/${totalPages} no trajo filas — se cortó la paginación ahí.`);
            break;
          }
          allRows.push(...rows);
        }

        if (totalCount > 0 && allRows.length !== totalCount) {
          warnings.push(
            `BAC reportó ${totalCount} proceso(s) "En Apertura" pero se leyeron ${allRows.length} (posible corte de paginación o cambios durante la lectura).`,
          );
        }
        if (Math.ceil(totalCount / PAGE_SIZE) > MAX_PAGES) {
          warnings.push(`Se alcanzó el máximo de ${MAX_PAGES} páginas — puede haber procesos sin leer.`);
        }

        const tenders = allRows.map(rowToTender);
        return { tenders, warnings };
      } finally {
        await browser.close();
      }
    },
  };
}
