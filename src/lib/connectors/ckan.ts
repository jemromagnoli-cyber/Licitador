/**
 * Cliente genérico para portales CKAN (el software detrás de datos.gob.ar,
 * data.buenosaires.gob.ar y la mayoría de los portales de datos abiertos
 * provinciales en Argentina). CKAN expone una API REST estándar bajo
 * `/api/3/action/...` que devuelve JSON — no hace falta scrapear HTML.
 *
 * Referencia: https://docs.ckan.org/en/latest/api/
 */

export interface CkanResource {
  id: string;
  name: string;
  format: string;
  url: string;
  last_modified?: string;
}

export interface CkanPackage {
  id: string;
  title: string;
  resources: CkanResource[];
}

export class CkanClient {
  constructor(private readonly baseUrl: string) {}

  async packageShow(datasetId: string): Promise<CkanPackage> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/api/3/action/package_show?id=${encodeURIComponent(datasetId)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`CKAN package_show respondió ${res.status} ${res.statusText} (${url})`);
    }
    const json = (await res.json()) as { success: boolean; result: CkanPackage };
    if (!json.success) {
      throw new Error(`CKAN package_show devolvió success=false para ${datasetId}`);
    }
    return json.result;
  }

  /** Busca el primer recurso cuyo formato coincida (case-insensitive). */
  findResourceByFormat(pkg: CkanPackage, formats: string[]): CkanResource | undefined {
    const wanted = formats.map((f) => f.toLowerCase());
    return pkg.resources.find((r) => wanted.includes((r.format ?? "").toLowerCase()));
  }

  async downloadResource(resource: CkanResource): Promise<string> {
    const res = await fetch(resource.url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      throw new Error(`No se pudo descargar el recurso ${resource.name}: ${res.status}`);
    }
    return res.text();
  }
}
