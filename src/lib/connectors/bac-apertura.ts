import https from "node:https";
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
 * CÓMO FUNCIONA (sin necesitar un navegador automatizado):
 * BuscarAvanzado.aspx es un formulario clásico de ASP.NET WebForms
 * (postback), no tiene una API en JSON. Pero se puede reproducir con
 * fetch normal:
 *   1. GET a la página para conseguir cookies de sesión + los campos
 *      ocultos que ASP.NET necesita (__VIEWSTATE, __VIEWSTATEGENERATOR,
 *      el token CSRF, etc).
 *   2. POST simulando "seleccionar Estado proceso = En Apertura" + click
 *      en "Buscar" (__EVENTTARGET = btnListarPliegoAvanzado).
 *   3. Los resultados vienen paginados de a 10. Para cada página siguiente
 *      se hace otro POST con __EVENTTARGET = GridListaPliegos y
 *      __EVENTARGUMENT = "Page$N", reusando el __VIEWSTATE más reciente
 *      (cada respuesta trae uno nuevo).
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
const REQUEST_TIMEOUT_MS = 30_000;
// Salvaguarda: si algo sale mal y la paginación no corta, no seguir para
// siempre. 400 páginas = 4000 procesos, muy por encima de lo esperado.
const MAX_PAGES = 400;

// Campos visibles del formulario (no ocultos) que controlamos nosotros.
// El resto de los campos (los ocultos: __VIEWSTATE, __VIEWSTATEGENERATOR,
// el token CSRF, y varios más específicos de los controles DevExpress del
// portal) se toman tal cual vienen en cada respuesta — ver extractHiddenFields.
const VISIBLE_FIELD_DEFAULTS: Record<string, string> = {
  "ctl00$CPH1$txtNumeroProceso": "",
  "ctl00$CPH1$txtExpediente": "",
  "ctl00$CPH1$txtNombrePliego": "",
  "ctl00$CPH1$ddlJurisdicion": "-2",
  "ctl00$CPH1$ddlUnidadEjecutora": "-2",
  "ctl00$CPH1$ddlTipoProceso": "-2",
  "ctl00$CPH1$ddlEstadoProceso": ESTADO_EN_APERTURA,
  "ctl00$CPH1$ddlRubro": "-2",
  "ctl00$CPH1$devCbPnlNombreProveedor$txtNombreProveedor": "",
  "ctl00$CPH1$txtFechaDesde": "",
  "ctl00$CPH1$txtFechaHasta": "",
  "ctl00$CPH1$ddlResultadoOrdenadoPor": "PLI.Pliego.NumeroPliego",
  "ctl00$CPH1$hidEstadoListaPliegos": "NOREPORTEEXCEL",
  "ctl00$CPH1$devCbPnlPopupListarProveedor$txtPopupNombreProveedor": "",
  "ctl00$CPH1$devCbPnlPopupListarProveedor$txtPopupCuitProveedor": "",
};

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (compatible; LicitadorBot/1.0; +https://licitador-production-d3a3.up.railway.app)",
  Referer: BASE_URL,
  Origin: "https://www.buenosairescompras.gob.ar",
  // Sin esto algunos servidores igual comprimen la respuesta (gzip/br) y,
  // como acá no la estamos descomprimiendo (no usamos fetch), terminaría
  // llegando como bytes binarios en vez de HTML.
  "Accept-Encoding": "identity",
};

const MAX_REDIRECTS = 5;

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

/** Extrae todos los <input type="hidden" ...> de la página (VIEWSTATE, token CSRF, etc). */
function extractHiddenFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const inputTags = html.match(/<input\b[^>]*>/gi) ?? [];
  for (const tag of inputTags) {
    const typeMatch = tag.match(/type\s*=\s*"([^"]*)"/i);
    if (!typeMatch || typeMatch[1].toLowerCase() !== "hidden") continue;
    const nameMatch = tag.match(/name\s*=\s*"([^"]*)"/i);
    if (!nameMatch) continue;
    const valueMatch = tag.match(/value\s*=\s*"([^"]*)"/i);
    fields[nameMatch[1]] = valueMatch ? decodeEntities(valueMatch[1]) : "";
  }
  return fields;
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

function mergeCookies(jar: Map<string, string>, setCookieHeaders: string[]): void {
  for (const header of setCookieHeaders) {
    const pair = header.split(";")[0] ?? "";
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const name = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (name) jar.set(name, value);
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/**
 * BAC corre en un servidor (IIS/ASP.NET viejo) que manda alguna respuesta
 * con un header que no cumple estrictamente RFC 7230 — probado en
 * producción, el `fetch` global de Node (undici, parser estricto) la
 * rechaza directo con "Response does not match the HTTP/1.1 protocol
 * (Invalid header value char)", sin llegar siquiera a leer el body. El
 * módulo `https` nativo de Node acepta `insecureHTTPParser: true`
 * (pensado exactamente para este tipo de servidor no del todo compliant),
 * así que para este conector se usa ese en vez de `fetch`.
 */
function rawRequest(
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
): Promise<{ html: string; status: number; headers: Record<string, string | string[] | undefined> }> {
  const parsedUrl = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: init.method,
        headers: init.headers,
        insecureHTTPParser: true,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            html: Buffer.concat(chunks).toString("utf-8"),
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
          });
        });
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error(`Timeout de ${REQUEST_TIMEOUT_MS}ms esperando respuesta de BAC`)));
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

/**
 * A diferencia de `fetch`, `https.request` no sigue redirects (3xx) solo —
 * hay que leer el header `Location` y volver a pedir a mano. BAC puede
 * mandar un redirect en la primera visita (ej: a una versión con "www." o
 * a establecer sesión) antes de servir la página real.
 */
async function fetchWithCookies(
  url: string,
  init: { method: "GET" | "POST"; headers?: Record<string, string>; body?: string },
  jar: Map<string, string>,
): Promise<{ html: string; status: number }> {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const headers: Record<string, string> = { ...COMMON_HEADERS, ...init.headers };
    const cookieStr = cookieHeader(jar);
    if (cookieStr) headers.Cookie = cookieStr;
    if (init.body) headers["Content-Length"] = String(Buffer.byteLength(init.body));

    const res = await rawRequest(currentUrl, { method: init.method, headers, body: init.body });
    const setCookie = res.headers["set-cookie"];
    if (setCookie) mergeCookies(jar, Array.isArray(setCookie) ? setCookie : [setCookie]);

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      const location = Array.isArray(res.headers.location) ? res.headers.location[0] : res.headers.location;
      currentUrl = new URL(location!, currentUrl).toString();
      continue;
    }

    return { html: res.html, status: res.status };
  }
  throw new Error(`Demasiados redirects (>${MAX_REDIRECTS}) siguiendo ${url}`);
}

/**
 * Node/undici envuelve el error real de fetch en un mensaje genérico
 * "fetch failed" — la causa de verdad (DNS, TLS, conexión rechazada, etc)
 * está en `err.cause`, a veces anidada más de un nivel. La vimos aparecer
 * así en producción con el primer intento de este conector, sin dar
 * ninguna pista útil — por eso este helper camina la cadena de causas.
 */
function describeFetchError(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  let depth = 0;
  while (current && depth < 5) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = (current as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      current = undefined;
    }
    depth++;
  }
  return parts.join(" | causa: ");
}

function buildBody(hiddenFields: Record<string, string>, eventTarget: string, eventArgument: string): string {
  const merged: Record<string, string> = {
    ...hiddenFields,
    ...VISIBLE_FIELD_DEFAULTS,
    __EVENTTARGET: eventTarget,
    __EVENTARGUMENT: eventArgument,
  };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) params.set(k, v);
  return params.toString();
}

export function createBacAperturaSource(): TenderSource {
  return {
    key: "bac-apertura",
    label: "Buenos Aires Compras (BAC) — procesos en apertura (vigentes)",
    async fetchTenders(): Promise<TenderSourceResult> {
      const warnings: string[] = [];
      const jar = new Map<string, string>();

      let initialHtml: string;
      let initialStatus: number;
      try {
        const initial = await fetchWithCookies(BASE_URL, { method: "GET" }, jar);
        initialHtml = initial.html;
        initialStatus = initial.status;
      } catch (err) {
        const cause = describeFetchError(err);
        throw new Error(`No se pudo abrir la búsqueda avanzada de BAC (${BASE_URL}): ${cause}`);
      }

      let hidden = extractHiddenFields(initialHtml);
      if (!hidden.__VIEWSTATE) {
        // Diagnóstico: si esto vuelve a fallar, el mensaje ya trae el
        // status HTTP y una muestra del body para no tener que iterar a
        // ciegas otra vez (ver historial: ya pasamos por "fetch failed"
        // por un header no compliant, y podría ser otra sorpresa distinta
        // la próxima vez — un WAF, una página de challenge, etc).
        const snippet = initialHtml.replace(/\s+/g, " ").trim().slice(0, 300);
        throw new Error(
          `No se pudo leer __VIEWSTATE de la página de búsqueda de BAC (status HTTP ${initialStatus}, body de ${initialHtml.length} chars). Primeros 300 chars: "${snippet}"`,
        );
      }

      let firstResultsHtml: string;
      let firstResultsStatus: number;
      try {
        const body = buildBody(hidden, "ctl00$CPH1$btnListarPliegoAvanzado", "");
        const first = await fetchWithCookies(
          BASE_URL,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
          jar,
        );
        firstResultsHtml = first.html;
        firstResultsStatus = first.status;
      } catch (err) {
        const cause = describeFetchError(err);
        throw new Error(`Falló la búsqueda "Estado proceso = En Apertura" en BAC: ${cause}`);
      }

      const totalCount = extractTotalCount(firstResultsHtml);
      const firstPageRows = extractDataRows(firstResultsHtml);

      if (totalCount === 0 && firstPageRows.length === 0) {
        // Diagnóstico (ver el de __VIEWSTATE más arriba, misma idea): si
        // esto vuelve a pasar, con esto alcanza para saber por qué sin
        // tener que iterar a ciegas otra vez.
        const hasGrid = firstResultsHtml.includes("GridListaPliegos");
        const hasEncontrado = firstResultsHtml.includes("encontrado");
        const snippet = firstResultsHtml.replace(/\s+/g, " ").trim().slice(0, 400);
        return {
          tenders: [],
          warnings: [
            `BAC devolvió 0 procesos "En Apertura" — status HTTP ${firstResultsStatus}, body de ${firstResultsHtml.length} chars, ¿tiene tabla de grilla?: ${hasGrid}, ¿tiene texto "encontrado"?: ${hasEncontrado}. Primeros 400 chars: "${snippet}"`,
          ],
        };
      }

      const allRows: BacRow[] = [...firstPageRows];
      hidden = extractHiddenFields(firstResultsHtml);

      const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE) || 1, MAX_PAGES);
      for (let page = 2; page <= totalPages; page++) {
        let pageHtml: string;
        try {
          const body = buildBody(hidden, "ctl00$CPH1$GridListaPliegos", `Page$${page}`);
          const pageRes = await fetchWithCookies(
            BASE_URL,
            { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body },
            jar,
          );
          pageHtml = pageRes.html;
        } catch (err) {
          const cause = describeFetchError(err);
          warnings.push(`Se cortó la paginación en la página ${page}/${totalPages}: ${cause}`);
          break;
        }

        const rows = extractDataRows(pageHtml);
        if (rows.length === 0) {
          warnings.push(`Página ${page}/${totalPages} no trajo filas — se cortó la paginación ahí.`);
          break;
        }
        allRows.push(...rows);
        hidden = extractHiddenFields(pageHtml);
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
    },
  };
}
