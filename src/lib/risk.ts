/**
 * Lógica de coloreado y niveles de riesgo.
 * Refleja la misma semántica que usa el monitor SMS (alerta_sms.py):
 * el sector "cruza" cuando risk_score >= umbral del sector.
 */

export type RiskLevel = 'bajo' | 'medio' | 'alto';

export function riskLevel(score: number, umbral = 31.16): RiskLevel {
  if (score >= umbral) return 'alto';
  if (score >= umbral * 0.7) return 'medio';
  return 'bajo';
}

/** Color de relleno para una celda del mapa */
export function riskColor(score: number, umbral = 31.16): string {
  const level = riskLevel(score, umbral);
  if (level === 'alto') return '#ef4444';
  if (level === 'medio') return '#f59e0b';
  return '#22c55e';
}

/** Opacidad: cuanto más riesgo, más sólida la celda */
export function riskOpacity(score: number, umbral = 31.16): number {
  const level = riskLevel(score, umbral);
  if (level === 'alto') return 0.75;
  if (level === 'medio') return 0.55;
  return 0.25;
}

export const LEVEL_LABEL: Record<RiskLevel, string> = {
  bajo: 'Riesgo bajo',
  medio: 'Riesgo medio',
  alto: 'RIESGO ALTO',
};
