import type { Diagnostico, RiskQuery, RiskResponse, Sector } from './types';

/** URLs configurables por .env (PUBLIC_* se exponen al navegador) */
export const API_BASE = (import.meta.env.PUBLIC_API_BASE ?? 'http://localhost:8000').replace(/\/$/, '');
export const SUBS_API_BASE = (import.meta.env.PUBLIC_SUBS_API_BASE ?? 'http://localhost:8100').replace(/\/$/, '');
export const SUBS_API_KEY = import.meta.env.PUBLIC_SUBS_API_KEY ?? '';

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * GET /risk del backend (Motor 1).
 * Ojo: el backend corre WhiteboxTools por llamada — puede tardar 20-90 s
 * la primera vez para un sector. El timeout es generoso por eso.
 */
export async function fetchRisk(q: RiskQuery, signal?: AbortSignal): Promise<RiskResponse> {
  const params = new URLSearchParams({ lat: String(q.lat), lon: String(q.lon) });
  if (q.bbox_offset_deg != null) params.set('bbox_offset_deg', String(q.bbox_offset_deg));
  if (q.rainfall_mm != null) params.set('rainfall_mm', String(q.rainfall_mm));
  if (q.event_start) params.set('event_start', q.event_start);
  if (q.event_end) params.set('event_end', q.event_end);
  if (q.fallback_waterway_coords) {
    params.set('fallback_waterway_coords', JSON.stringify(q.fallback_waterway_coords));
  }

  const res = await fetch(`${API_BASE}/risk?${params.toString()}`, { signal });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* cuerpo no JSON */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as RiskResponse;
}

/** Helper: arma la consulta a partir de un sector + lluvia simulada (o null = lluvia real) + fechas históricas */
export function riskQueryFor(sector: Sector, rainfallMm: number | null, eventStart?: string, eventEnd?: string): RiskQuery {
  return {
    lat: sector.lat,
    lon: sector.lon,
    bbox_offset_deg: sector.bbox_offset_deg,
    rainfall_mm: rainfallMm,
    event_start: eventStart,
    event_end: eventEnd,
    fallback_waterway_coords: sector.fallback_waterway_coords,
  };
}

/** ¿Está vivo el backend? Prueba /health (agregado en main.py) y, si no existe, /openapi.json */
export async function backendAlive(timeoutMs = 4000): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    for (const path of ['/health', '/openapi.json']) {
      try {
        const res = await fetch(`${API_BASE}${path}`, { signal: ctrl.signal });
        if (res.ok) return true;
      } catch {
        /* probar siguiente */
      }
    }
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** GET /diagnostico: prueba cada dependencia externa del backend (tarda hasta ~40 s) */
export async function fetchDiagnostico(): Promise<Diagnostico> {
  const res = await fetch(`${API_BASE}/diagnostico`);
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  return (await res.json()) as Diagnostico;
}

// ----------------------------------------------------------- suscriptores (Motor 2)

function subsHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', 'X-API-Key': SUBS_API_KEY };
}

export async function subsAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${SUBS_API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listSectoresSuscripcion(): Promise<string[]> {
  const res = await fetch(`${SUBS_API_BASE}/sectores`, { headers: subsHeaders() });
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  const body = await res.json();
  return body.sectores as string[];
}

export interface SuscriptorMasked {
  telefono: string;
  sector: string;
  alta: string;
}

export async function listSuscriptores(sector?: string): Promise<SuscriptorMasked[]> {
  const url = new URL(`${SUBS_API_BASE}/suscriptores`);
  if (sector) url.searchParams.set('sector', sector);
  const res = await fetch(url, { headers: subsHeaders() });
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
  const body = await res.json();
  return body.suscriptores as SuscriptorMasked[];
}

export async function subscribe(telefono: string, sector: string): Promise<{ telefono: string; sector: string }> {
  const res = await fetch(`${SUBS_API_BASE}/suscriptores`, {
    method: 'POST',
    headers: subsHeaders(),
    body: JSON.stringify({ telefono, sector, consentimiento: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((d: { msg?: string }) => d.msg).join(', ')
      : body?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(String(detail), res.status);
  }
  return body;
}

export async function testAlert(sector: string, riesgo: number): Promise<{ ok: boolean; enviados: number }> {
  const res = await fetch(`${SUBS_API_BASE}/test_alert`, {
    method: 'POST',
    headers: subsHeaders(),
    body: JSON.stringify({ sector, riesgo }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(body?.detail)
      ? body.detail.map((d: { msg?: string }) => d.msg).join(', ')
      : body?.detail ?? `HTTP ${res.status}`;
    throw new ApiError(String(detail), res.status);
  }
  return body;
}
