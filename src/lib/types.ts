/**
 * Contrato de datos con el backend FloodPulse (GET /risk).
 * Fuente: floodpulse-backend/src/main.py -> RiskResponse
 */

export interface RiskCellProperties {
  /** Índice de riesgo 0-100 de la celda de 100x100 m */
  risk_score: number;
  /** Topographic Wetness Index crudo */
  twi_raw: number;
  /** Distancia al cauce más cercano en metros */
  dist_m: number;
  /** % de superficie impermeable (clase 50 ESA WorldCover) */
  imperv_pct: number;
}

export interface RiskFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: RiskCellProperties;
}

export interface RiskGrid {
  type: 'FeatureCollection';
  features: RiskFeature[];
}

export interface RiskComponents {
  rainfall_mm: number;
  twi_max: number;
  distance_to_channel_m: number;
  imperviousness_pct: number;
  region?: 'sierra' | 'costa';
  waterway_source?: 'osm' | 'fallback' | 'none';
  rainfall_detail?: Record<string, unknown>;
}

export interface RiskResponse {
  lat: number;
  lon: number;
  /** Máximo de todas las celdas de la grilla */
  risk_score: number;
  timestamp: string;
  components: RiskComponents;
  grid_geojson: RiskGrid;
  /** Avisos no fatales del backend (GEE sin credenciales, Overpass caído + fallback, etc.) */
  warnings?: string[];
  /** Duración de cada etapa en segundos */
  timing_s?: Record<string, number>;
}

/** GET /diagnostico del backend */
export interface DiagnosticoCheck {
  ok: boolean;
  detalle: string;
  segundos: number;
}
export interface Diagnostico {
  ok: boolean;
  resumen: string;
  lluvia_real_disponible: boolean;
  checks: Record<string, DiagnosticoCheck>;
  ultimos_errores: Record<string, string>;
}

/** Parámetros aceptados por GET /risk */
export interface RiskQuery {
  lat: number;
  lon: number;
  bbox_offset_deg?: number;
  /** Si se envía, el backend NO consulta lluvia externa (no necesita Earth Engine) */
  rainfall_mm?: number | null;
  event_start?: string;
  event_end?: string;
  /** [[lon, lat], ...] — solo para cauces embovedados (Ajaví) */
  fallback_waterway_coords?: number[][];
}

/**
 * Sector monitoreado. Espejo de floodpulse-alerts/suscriptores.json:
 * el nombre debe coincidir EXACTAMENTE para que el formulario de
 * suscripción y el monitor SMS hablen del mismo sector.
 */
export interface Sector {
  sector: string;
  lat: number;
  lon: number;
  /** Umbral de alerta (risk_score >= umbral dispara SMS) */
  umbral: number;
  /** Histéresis: el sector se rearma cuando baja de este valor */
  umbral_salida: number;
  bbox_offset_deg?: number;
  fallback_waterway_coords?: number[][];
  descripcion?: string;
  historical_events?: { name: string; start: string; end: string }[];
}

export type DataSource = 'backend' | 'mock';
