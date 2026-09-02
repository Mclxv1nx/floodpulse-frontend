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
    historical_events: [{ name: 'Inundación Marzo 2025', start: '2025-03-10', end: '2025-03-11' }],
  },
  {
    sector: 'Ajaví, Ibarra',
    lat: 0.35502,
    lon: -78.12463,
    umbral: 70,
    umbral_salida: 60,
    fallback_waterway_coords: [
      [-78.12, 0.35],
      [-78.13, 0.36],
    ],
    descripcion: 'Evento real abril 2025 (40.8 mm). Cauce embovedado, usa fallback.',
    historical_events: [{ name: 'Desbordamiento Abril 2025', start: '2025-04-07', end: '2025-04-08' }],
  },
  {
    sector: 'Guayaquil (Centro)',
    lat: -2.1932,
    lon: -79.8789,
    umbral: 70,
    umbral_salida: 60,
    descripcion: 'Ciclón Yaku 2023 (199 mm) y abril 2025 (275 mm).',
    historical_events: [
      { name: 'Ciclón Yaku', start: '2023-03-23', end: '2023-03-24' },
      { name: 'Peor Evento 2025', start: '2025-04-01', end: '2025-04-03' },
      { name: 'Lluvias C4 Jun 2026', start: '2026-06-07', end: '2026-06-09' },
    ],
  },
  {
    sector: 'Esmeraldas (Centro)',
    lat: 0.959,
    lon: -79.654,
    umbral: 70,
    umbral_salida: 60,
    descripcion: 'Inundaciones catastróficas 2023 (100 mm).',
    historical_events: [{ name: 'Inundaciones Junio 2023', start: '2023-06-03', end: '2023-06-04' }],
  },
  {
    sector: 'Portoviejo',
    lat: -1.056,
    lon: -80.455,
    umbral: 70,
    umbral_salida: 60,
    descripcion: 'Inundaciones febrero 2025 (89.5 mm).',
    historical_events: [{ name: 'Inundaciones Febrero 2025', start: '2025-02-19', end: '2025-02-20' }],
  },
  {
    sector: 'Salinas',
    lat: -2.2155,
    lon: -80.9632,
    umbral: 70,
    umbral_salida: 60,
    fallback_waterway_coords: [
      [-80.965, -2.215],
      [-80.960, -2.216],
    ],
    descripcion: 'Inundaciones severas en costa (77.5 mm). Requiere fallback.',
    historical_events: [{ name: 'Inundación Febrero 2025', start: '2025-02-22', end: '2025-02-23' }],
  },
];

export const SECTOR_DEFAULT = SECTORES[0];

/** La fórmula del backend satura la lluvia en 45 mm (config.py -> max_rainfall_mm) */
export const MAX_RAINFALL_MM = 45;
