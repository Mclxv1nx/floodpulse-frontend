import { useCallback, useEffect, useRef, useState } from 'react';
import RiskMap from './RiskMap';
import SubscribeForm from './SubscribeForm';
import Toasts from './Toasts';
import DebugPanel from './DebugPanel';
import { API_BASE, backendAlive, fetchRisk, riskQueryFor } from '@/lib/api';
import { buildMockRisk } from '@/lib/mock';
import { explainFetchError, notify } from '@/lib/notify';
import { LEVEL_LABEL, riskColor, riskLevel } from '@/lib/risk';
import { MAX_RAINFALL_MM, SECTORES, SECTOR_DEFAULT } from '@/lib/sectores';
import type { DataSource, RiskResponse, Sector } from '@/lib/types';

interface AlertEvent {
  at: Date;
  sector: string;
  score: number;
}

const AUTO_REFRESH_S = 120; // en modo "lluvia real" (el backend es lento)

export default function Dashboard() {
  const [sector, setSector] = useState<Sector>(SECTOR_DEFAULT);
  const [rain, setRain] = useState<number>(10);
  /** valor del slider mientras se arrastra; `rain` se actualiza con retardo para no
   *  disparar una llamada al backend (30-90 s cada una) por cada pixel */
  const [rainDraft, setRainDraft] = useState<number>(10);
  const rainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** true = pedir lluvia real (IMERG + Open-Meteo); false = rainfall_mm simulado */
  const [realRain, setRealRain] = useState(false);
  const [source, setSource] = useState<DataSource>('mock');
  const [autoSource, setAutoSource] = useState(true);
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);

  // histéresis igual que alerta_sms.py: no repetir alerta hasta que baje de umbral_salida
  const enAlerta = useRef<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  // Detecta el backend al arrancar y elige la fuente automáticamente
  useEffect(() => {
    void backendAlive().then((ok) => {
      if (autoSource) setSource(ok ? 'backend' : 'mock');
      notify(
        ok ? 'ok' : 'warn',
        ok ? 'Backend detectado' : 'Backend no disponible: modo mock',
        ok ? API_BASE : `Nada responde en ${API_BASE}. Se usa GeoJSON simulado hasta que arranques floodpulse-backend.`,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (!opts?.silent) setLoading(true);
      setError(null);
      const t0 = performance.now();
      const tick = setInterval(() => setElapsed(Math.round((performance.now() - t0) / 1000)), 1000);
      try {
        let res: RiskResponse;
        if (source === 'backend') {
          res = await fetchRisk(riskQueryFor(sector, realRain ? null : rain), ctrl.signal);
        } else {
          await new Promise((r) => setTimeout(r, 250)); // pequeño delay para que se note el refresco
          res = buildMockRisk(sector, realRain ? 12 : rain);
        }
        if (ctrl.signal.aborted) return;
        setData(res);

        if (source === 'backend') {
          const secs = res.timing_s?.total_s ?? Math.round((performance.now() - t0) / 1000);
          notify('ok', `Riesgo ${res.risk_score.toFixed(1)} en ${secs}s`, `${sector.sector} · ${res.grid_geojson.features.length} celdas · cauce: ${res.components.waterway_source ?? '?'}`, { toast: false });
          for (const w of res.warnings ?? []) notify('warn', 'Aviso del backend', w);
          if (res.grid_geojson.features.length === 0) notify('warn', 'El backend devolvió una grilla vacía', 'No hay celdas para pintar (¿mock_risk_api en el puerto 8000?).');
        } else {
          notify('info', `Mock: riesgo ${res.risk_score.toFixed(1)} (${sector.sector}, ${res.components.rainfall_mm} mm)`, undefined, { toast: false });
        }

        // Misma lógica que debe_alertar() en alerta_sms.py
        const st = enAlerta.current;
        if (res.risk_score < sector.umbral_salida) st[sector.sector] = false;
        else if (res.risk_score >= sector.umbral && !st[sector.sector]) {
          st[sector.sector] = true;
          setEvents((ev) => [{ at: new Date(), sector: sector.sector, score: res.risk_score }, ...ev].slice(0, 8));
          notify('error', `⚠ ${sector.sector} cruzó el umbral (${res.risk_score.toFixed(1)} ≥ ${sector.umbral})`, 'El monitor SMS dispara la alerta en su próximo ciclo.', { ttl: 10000 });
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        // Sondear /health para distinguir "backend apagado" de "backend respondió mal"
        const alive = source === 'backend' ? await backendAlive() : null;
        const why = explainFetchError(e, API_BASE, alive);
        setError(`${why.title}: ${why.detail}`);
        notify('error', why.title, why.detail, { ttl: 15000 });
        if (autoSource && source === 'backend' && alive === false) {
          setSource('mock');
          notify('warn', 'Cambiando a modo mock', 'El backend no responde; se muestra la grilla simulada.');
        }
        if (/fetch/i.test(msg) && alive === true) {
          notify('info', 'Sugerencia', 'Abre el panel Debug → "Diagnosticar conexiones" para ver qué dependencia externa falla.', { toast: false });
        }
      } finally {
        clearInterval(tick);
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setElapsed(0);
        }
      }
    },
    [sector, rain, realRain, source, autoSource],
  );

  // Recalcular al cambiar sector / lluvia / fuente
  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Auto-refresh solo en modo lluvia real contra backend
  useEffect(() => {
    if (!(realRain && source === 'backend')) return;
    const id = setInterval(() => void load({ silent: true }), AUTO_REFRESH_S * 1000);
    return () => clearInterval(id);
  }, [realRain, source, load]);

  const score = data?.risk_score ?? 0;
  const level = riskLevel(score, sector.umbral);
  const cruzado = score >= sector.umbral;

  return (
    <div className={`app level-${level}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={34} height={34} />
          <div>
            <h1>FloodPulse</h1>
            <p>Riesgo de inundación hiperlocal · alerta SMS 2G</p>
          </div>
        </div>

        <section className="card">
          <label className="field">
            Sector monitoreado
            <select
              value={sector.sector}
              onChange={(e) => setSector(SECTORES.find((s) => s.sector === e.target.value) ?? SECTOR_DEFAULT)}
            >
              {SECTORES.map((s) => (
                <option key={s.sector} value={s.sector}>
                  {s.sector}
                </option>
              ))}
            </select>
          </label>
          {sector.descripcion && <p className="hint">{sector.descripcion}</p>}

          <div className="field">
            <div className="row">
              <span>Lluvia acumulada</span>
              <b>{realRain ? 'satélite + pronóstico' : `${rainDraft} mm`}</b>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_RAINFALL_MM}
              step={1}
              value={rainDraft}
              disabled={realRain}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRainDraft(v);
                if (rainTimer.current) clearTimeout(rainTimer.current);
                rainTimer.current = setTimeout(() => setRain(v), source === 'backend' ? 700 : 150);
              }}
            />
            <small className="hint">La fórmula satura a {MAX_RAINFALL_MM} mm (config.py). Arrastra para simular la tormenta.</small>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={realRain}
              onChange={(e) => {
                setRealRain(e.target.checked);
                if (e.target.checked)
                  notify('info', 'Lluvia real activada', 'Sin credenciales de Earth Engine el backend usa solo el pronóstico de Open-Meteo (IMERG = 0) y lo avisa en warnings.');
              }}
            />
            Usar lluvia real (IMERG + Open-Meteo, requiere Earth Engine en el backend)
          </label>
        </section>

        <section className={`card risk risk-${level}`}>
          <header className="card-head">
            <h3>Índice de riesgo</h3>
            <span className="badge">{LEVEL_LABEL[level]}</span>
          </header>
          <div className="score" style={{ color: riskColor(score, sector.umbral) }}>
            {data ? score.toFixed(1) : '—'}
            <small>/ 100 · umbral {sector.umbral}</small>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${Math.min(score, 100)}%`, background: riskColor(score, sector.umbral) }} />
            <div className="bar-threshold" style={{ left: `${sector.umbral}%` }} title={`Umbral ${sector.umbral}`} />
          </div>

          {data && (
            <dl className="components">
              <div><dt>Lluvia</dt><dd>{data.components.rainfall_mm.toFixed(1)} mm</dd></div>
              <div><dt>TWI máx.</dt><dd>{data.components.twi_max}</dd></div>
              <div><dt>Dist. cauce</dt><dd>{data.components.distance_to_channel_m} m</dd></div>
              <div><dt>Impermeab.</dt><dd>{data.components.imperviousness_pct}%</dd></div>
            </dl>
          )}

          {cruzado && (
            <div className="alert-banner">
              <strong>⚠ Umbral superado</strong>
              El monitor <code>alerta_sms.py</code> dispara el SMS a los suscriptores de {sector.sector}.
            </div>
          )}
        </section>

        <SubscribeForm sector={sector} />

        {events.length > 0 && (
          <section className="card">
            <header className="card-head"><h3>Alertas disparadas</h3></header>
            <ul className="events">
              {events.map((ev, i) => (
                <li key={i}>
                  <span>{ev.at.toLocaleTimeString()}</span> {ev.sector} · <b>{ev.score.toFixed(1)}</b>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="status">
          <div className="row">
            <span>Fuente</span>
            <select
              value={autoSource ? 'auto' : source}
              onChange={(e) => {
                const v = e.target.value;
                if (v === 'auto') {
                  setAutoSource(true);
                  void backendAlive().then((ok) => {
                    setSource(ok ? 'backend' : 'mock');
                    notify('info', `Fuente automática: ${ok ? 'backend real' : 'mock'}`);
                  });
                } else {
                  setAutoSource(false);
                  setSource(v as DataSource);
                  notify('info', `Fuente forzada: ${v === 'backend' ? 'backend real' : 'mock local'}`);
                }
              }}
            >
              <option value="auto">auto ({source})</option>
              <option value="backend">backend real</option>
              <option value="mock">mock local</option>
            </select>
          </div>
          <div className="row">
            <span>Backend</span>
            <code>{API_BASE}</code>
          </div>
          {data && (
            <div className="row">
              <span>Actualizado</span>
              <span>{new Date(data.timestamp).toLocaleTimeString()}</span>
            </div>
          )}
          {loading && <p className="hint">Calculando… {elapsed}s {source === 'backend' && '(WhiteboxTools + satélite, puede tardar ~1 min)'}</p>}
          {error && <p className="hint warn">Error: {error}</p>}
          <button className="ghost" onClick={() => void load()} disabled={loading}>
            Recalcular ahora
          </button>
        </footer>
      </aside>

      <main className="main">
        <RiskMap sector={sector} grid={data?.grid_geojson ?? null} loading={loading} />
        <Toasts />
        <DebugPanel last={data} source={source} />
      </main>
    </div>
  );
}
