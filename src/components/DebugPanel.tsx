import { useState } from 'react';
import { API_BASE, SUBS_API_BASE, backendAlive, fetchDiagnostico, subsAlive } from '@/lib/api';
import { clearLog, notify, useNotifications } from '@/lib/notify';
import type { Diagnostico, RiskResponse } from '@/lib/types';

interface Props {
  /** Última respuesta del backend (para mostrar timing y detalle de lluvia) */
  last: RiskResponse | null;
  source: string;
}

const CHECK_LABEL: Record<string, string> = {
  planetary_computer: 'Planetary Computer (DEM + WorldCover)',
  open_meteo: 'Open-Meteo (pronóstico)',
  overpass_osm: 'OpenStreetMap / Overpass (cauces)',
  earth_engine: 'Google Earth Engine (IMERG, lluvia real)',
  whitebox: 'WhiteboxTools (TWI)',
};

/**
 * Panel de depuración plegable (esquina inferior derecha del mapa):
 * log de eventos, tiempos del backend y botón de diagnóstico de dependencias.
 */
export default function DebugPanel({ last, source }: Props) {
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [running, setRunning] = useState(false);
  const { log } = useNotifications();
  const errores = log.filter((n) => n.level === 'error').length;
  const avisos = log.filter((n) => n.level === 'warn').length;

  async function runDiagnostico() {
    setRunning(true);
    setDiag(null);
    notify('info', 'Diagnóstico iniciado', 'Probando backend, API de suscriptores y fuentes externas…', { ttl: 3000 });
    const [b, s] = await Promise.all([backendAlive(), subsAlive()]);
    notify(b ? 'ok' : 'error', `Backend ${b ? 'vivo' : 'NO responde'}`, API_BASE, { toast: !b });
    notify(s ? 'ok' : 'warn', `API suscriptores ${s ? 'viva' : 'NO responde'}`, SUBS_API_BASE, { toast: !s });
    if (b) {
      try {
        const d = await fetchDiagnostico();
        setDiag(d);
        const fallidos = Object.entries(d.checks).filter(([, c]) => !c.ok).map(([k]) => CHECK_LABEL[k] ?? k);
        if (fallidos.length === 0) notify('ok', 'Todas las dependencias del backend responden');
        else notify(d.ok ? 'warn' : 'error', `Fallan: ${fallidos.join(', ')}`, d.resumen);
      } catch (e) {
        notify('error', 'No se pudo ejecutar /diagnostico', e instanceof Error ? e.message : String(e));
      }
    }
    setRunning(false);
  }

  return (
    <div className={`debug ${open ? 'open' : ''}`}>
      <button className="debug-toggle" onClick={() => setOpen(!open)} title="Panel de depuración">
        🛠 Debug
        {errores > 0 && <span className="pill err">{errores}</span>}
        {avisos > 0 && <span className="pill warn">{avisos}</span>}
      </button>

      {open && (
        <div className="debug-body">
          <div className="debug-row">
            <button onClick={runDiagnostico} disabled={running}>
              {running ? 'Diagnosticando…' : 'Diagnosticar conexiones'}
            </button>
            <button className="ghost" onClick={clearLog}>Limpiar log</button>
          </div>

          <div className="debug-kv">
            <span>Fuente</span><code>{source}</code>
            <span>Backend</span><code>{API_BASE}</code>
            <span>Suscriptores</span><code>{SUBS_API_BASE}</code>
            {last?.timing_s && (
              <>
                <span>Tiempos</span>
                <code>
                  {Object.entries(last.timing_s).map(([k, v]) => `${k.replace('_s', '')} ${v}s`).join(' · ')}
                </code>
              </>
            )}
            {last?.components?.waterway_source && (
              <>
                <span>Cauce</span>
                <code>{last.components.waterway_source} · región {last.components.region}</code>
              </>
            )}
            {last?.components?.rainfall_detail && (
              <>
                <span>Lluvia</span>
                <code>{JSON.stringify(last.components.rainfall_detail)}</code>
              </>
            )}
          </div>

          {diag && (
            <ul className="checks">
              {Object.entries(diag.checks).map(([k, c]) => (
                <li key={k} className={c.ok ? 'ok' : 'fail'}>
                  <b>{c.ok ? '✓' : '✕'} {CHECK_LABEL[k] ?? k}</b>
                  <small>{c.detalle} ({c.segundos}s)</small>
                </li>
              ))}
              <li className={diag.lluvia_real_disponible ? 'ok' : 'fail'}>
                <b>Lluvia real {diag.lluvia_real_disponible ? 'disponible' : 'NO disponible'}</b>
                <small>{diag.lluvia_real_disponible ? 'IMERG + Open-Meteo listos' : 'Usa el slider (rainfall_mm) o autentica Earth Engine.'}</small>
              </li>
            </ul>
          )}

          <ul className="log">
            {log.length === 0 && <li className="info"><small>Sin eventos todavía.</small></li>}
            {log.map((n) => (
              <li key={n.id} className={n.level}>
                <span className="t">{n.at.toLocaleTimeString()}</span>
                <b>{n.title}</b>
                {n.detail && <small>{n.detail}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
