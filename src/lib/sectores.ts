import type { Sector } from './types';

/**
 * Sectores de referencia (eventos reales documentados por el equipo de backend,
 * ver floodpulse-backend/run_validation.py y README).
 *
 * IMPORTANTE: el campo `sector` debe coincidir con floodpulse-alerts/suscriptores.json
 * para que las altas desde el dashboard lleguen al monitor SMS.
 */
export const SECTORES: Sector[] = [
  {
    sector: 'Malacatos, Loja',
    lat: -3.994537,
    lon: -79.205415,
    umbral: 70,
    umbral_salida: 60,
    descripcion: 'Evento real marzo 2025 (40 mm). Sector por defecto de la demo.',
  },
  {
    sector: 'Ajaví, Ibarra',
    lat: 0.35502,
    lon: -78.12463,
    umbral: 70,
    umbral_salida: 60,
    // El colector de Ajaví está embovedado: no existe en OpenStreetMap,
    // por eso se pasa el trazado manual al backend.
    fallback_waterway_coords: [
      [-78.12, 0.35],
      [-78.13, 0.36],
    ],
    descripcion: 'Evento real abril 2025 (40.8 mm). Cauce embovedado, usa fallback.',
  },
  {
    sector: 'Guayaquil (Centro)',
    lat: -2.1932,
    lon: -79.8789,
    umbral: 70,
    umbral_salida: 60,
    descripcion: 'Ciclón Yaku 2023 (199 mm) y abril 2025 (275 mm).',
  },
];

export const SECTOR_DEFAULT = SECTORES[0];

/** La fórmula del backend satura la lluvia en 25 mm (config.py -> max_rainfall_mm) */
export const MAX_RAINFALL_MM = 25;
