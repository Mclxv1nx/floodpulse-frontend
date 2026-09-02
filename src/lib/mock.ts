import type { RiskFeature, RiskResponse, Sector } from './types';
import { MAX_RAINFALL_MM } from './sectores';

/**
 * Generador de GeoJSON simulado (Día 1 de la guía): reproduce la MISMA fórmula
 * del backend (risk_model.py) sobre una grilla de 100x100 m, con terreno
 * inventado pero determinista por sector. Sirve para que el mapa y la lógica
 * de coloreado funcionen aunque el backend no esté levantado.
 *
 * Pesos (config.py): lluvia 40 %, TWI 20 %, distancia al cauce 25 %, impermeabilidad 15 %.
 */

const WEIGHTS = { rainfall: 0.4, twi: 0.2, distance: 0.25, impervious: 0.15 };
const SAFE_DISTANCE_M = 500;
const MAX_TWI = 15;

/** PRNG determinista (mulberry32) para que el mock sea estable entre renders */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(sector: Sector) {
  return Math.round(Math.abs(sector.lat * 1e5) + Math.abs(sector.lon * 1e5));
}

export function buildMockRisk(sector: Sector, rainfallMm: number): RiskResponse {
  const offset = sector.bbox_offset_deg ?? 0.005; // ~500 m
  const cellDeg = 0.0009; // ≈ 100 m
  const minLon = sector.lon - offset;
  const minLat = sector.lat - offset;
  const maxLon = sector.lon + offset;
  const maxLat = sector.lat + offset;

  const rand = rng(seedFrom(sector));
  const rainNorm = Math.min(rainfallMm / MAX_RAINFALL_MM, 1);

  // "Cauce" simulado: una línea diagonal que atraviesa el bbox
  const channelAngle = rand() * Math.PI;
  const dirX = Math.cos(channelAngle);
  const dirY = Math.sin(channelAngle);

  const features: RiskFeature[] = [];
  let maxScore = 0;
  let best = { twi: 0, dist: SAFE_DISTANCE_M, imperv: 0 };

  for (let lon = minLon; lon < maxLon; lon += cellDeg) {
    for (let lat = minLat; lat < maxLat; lat += cellDeg) {
      const cx = lon + cellDeg / 2;
      const cy = lat + cellDeg / 2;

      // distancia perpendicular al cauce simulado, en metros (1° ≈ 111 km)
      const rx = (cx - sector.lon) * 111_000;
      const ry = (cy - sector.lat) * 111_000;
      const dist = Math.abs(rx * dirY - ry * dirX);
      const distNorm = Math.max(0, Math.min(1, 1 - dist / SAFE_DISTANCE_M));

      // TWI más alto cerca del cauce (zonas bajas) con algo de ruido
      const twiRaw = Math.min(MAX_TWI + 3, 6 + distNorm * 8 + rand() * 4);
      const twiNorm = Math.max(0, Math.min(1, twiRaw / MAX_TWI));

      // impermeabilización: manchas urbanas
      const impervNorm = Math.max(0, Math.min(1, 0.35 + (rand() - 0.5) * 0.9));

      const score =
        (rainNorm * WEIGHTS.rainfall +
          twiNorm * WEIGHTS.twi +
          distNorm * WEIGHTS.distance +
          impervNorm * WEIGHTS.impervious) *
        100;

      const risk = Math.round(score * 100) / 100;
      if (risk > maxScore) {
        maxScore = risk;
        best = { twi: twiRaw, dist, imperv: impervNorm * 100 };
      }

      features.push({
        type: 'Feature',
        id: features.length,
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [lon, lat],
              [lon + cellDeg, lat],
              [lon + cellDeg, lat + cellDeg],
              [lon, lat + cellDeg],
              [lon, lat],
            ],
          ],
        },
        properties: {
          risk_score: risk,
          twi_raw: Math.round(twiRaw * 100) / 100,
          dist_m: Math.round(dist * 10) / 10,
          imperv_pct: Math.round(impervNorm * 1000) / 10,
        },
      });
    }
  }

  return {
    lat: sector.lat,
    lon: sector.lon,
    risk_score: maxScore,
    timestamp: new Date().toISOString(),
    components: {
      rainfall_mm: rainfallMm,
      twi_max: Math.round(best.twi * 100) / 100,
      distance_to_channel_m: Math.round(best.dist * 10) / 10,
      imperviousness_pct: Math.round(best.imperv * 10) / 10,
    },
    grid_geojson: { type: 'FeatureCollection', features },
  };
}
