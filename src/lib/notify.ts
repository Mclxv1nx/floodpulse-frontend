import { useSyncExternalStore } from 'react';

/**
 * Bus de notificaciones para el dashboard.
 * - `notify()` deja un registro en el log (panel de debug) y, si `toast` no es false,
 *   muestra un aviso flotante que se cierra solo.
 * - Los componentes se suscriben con `useNotifications()`.
 */

export type Level = 'info' | 'ok' | 'warn' | 'error';

export interface Notice {
  id: number;
  at: Date;
  level: Level;
  title: string;
  detail?: string;
  /** ms que dura el toast; 0 = no mostrar toast (solo log) */
  ttl: number;
}

const MAX_LOG = 80;
const DEFAULT_TTL: Record<Level, number> = { info: 4000, ok: 4000, warn: 8000, error: 12000 };

let seq = 0;
let log: Notice[] = [];
let toasts: Notice[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function notify(level: Level, title: string, detail?: string, opts?: { toast?: boolean; ttl?: number }) {
  const n: Notice = {
    id: ++seq,
    at: new Date(),
    level,
    title,
    detail,
    ttl: opts?.toast === false ? 0 : (opts?.ttl ?? DEFAULT_TTL[level]),
  };
  log = [n, ...log].slice(0, MAX_LOG);
  if (n.ttl > 0) {
    toasts = [...toasts, n];
    setTimeout(() => dismiss(n.id), n.ttl);
  }
  // Espejo en consola del navegador para cuando se depura con DevTools
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  fn(`[FloodPulse:${level}] ${title}${detail ? ' — ' + detail : ''}`);
  emit();
  return n.id;
}

export function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function clearLog() {
  log = [];
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useNotifications() {
  const l = useSyncExternalStore(subscribe, () => log, () => log);
  const t = useSyncExternalStore(subscribe, () => toasts, () => toasts);
  return { log: l, toasts: t };
}

/**
 * Clasifica un error de fetch para explicar QUÉ falló y DÓNDE.
 * `backendAlive` es el resultado de sondear /health justo después del error.
 */
export function explainFetchError(err: unknown, apiBase: string, backendAlive: boolean | null): { title: string; detail: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;

  if (err instanceof DOMException && err.name === 'AbortError') {
    return { title: 'Petición cancelada', detail: 'Se lanzó otra consulta antes de que terminara la anterior.' };
  }
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    if (backendAlive === false) {
      return {
        title: 'Backend no responde',
        detail: `Nada escucha en ${apiBase}. Arranca floodpulse-backend (start.ps1) o revisa PUBLIC_API_BASE en .env. Si está corriendo, un antivirus/firewall puede estar bloqueando el puerto.`,
      };
    }
    if (backendAlive === true) {
      return {
        title: 'El backend respondió sin cabeceras CORS',
        detail:
          'El servidor está vivo pero la respuesta fue rechazada por el navegador: casi siempre es una excepción no controlada (500) en el backend que sale fuera del middleware de CORS. Mira la consola de uvicorn: allí está el traceback (típico: OSM Timeout / Overpass 502).',
      };
    }
    return { title: 'Error de red', detail: `El navegador no pudo conectar con ${apiBase}.` };
  }
  if (status === 502) return { title: 'Fuente externa caída (502)', detail: msg };
  if (status === 503) return { title: 'OpenStreetMap/Overpass no disponible (503)', detail: msg };
  if (status === 500) return { title: 'Error interno del backend (500)', detail: msg };
  if (status === 422 || status === 400) return { title: 'Parámetros inválidos', detail: msg };
  if (status === 401) return { title: 'API key inválida', detail: 'PUBLIC_SUBS_API_KEY no coincide con API_KEY en floodpulse-alerts/.env' };
  return { title: `Error${status ? ' HTTP ' + status : ''}`, detail: msg };
}
