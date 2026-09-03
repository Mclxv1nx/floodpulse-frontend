import { useCallback, useEffect, useRef, useState } from 'react';
import RiskMap from './RiskMap';
import SubscribeForm from './SubscribeForm';
import Toasts from './Toasts';
import DebugPanel from './DebugPanel';
import SearchBar from './SearchBar';
import { API_BASE, backendAlive, fetchRisk, riskQueryFor } from '@/lib/api';
import { buildMockRisk } from '@/lib/mock';
import { explainFetchError, notify } from '@/lib/notify';
import { LEVEL_LABEL, riskColor, riskLevel } from '@/lib/risk';
import { MAX_RAINFALL_MM, SECTOR_DEFAULT } from '@/lib/sectores';
import type { DataSource, RiskResponse, Sector } from '@/lib/types';

interface AlertEvent {
  at: Date;
  sector: string;
  score: number;
}

const AUTO_REFRESH_S = 120;

export default function Dashboard() {
  const [sector, setSector] = useState<Sector>(SECTOR_DEFAULT);
  const [clickedPoint, setClickedPoint] = useState<{lat: number, lon: number} | null>(null);
  
  const [rain, setRain] = useState<number>(60);
  const [rainDraft, setRainDraft] = useState<number>(60);
  const rainTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [minimized, setMinimized] = useState(false);
  
  const [realRain, setRealRain] = useState(true);
  const [eventStart, setEventStart] = useState<string>('');
  const [eventEnd, setEventEnd] = useState<string>('');
  
  const [source, setSource] = useState<DataSource>('mock');
  const [autoSource, setAutoSource] = useState(true);
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const enAlerta = useRef<Record<string, boolean>>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    void backendAlive().then((ok) => {
      if (autoSource) setSource(ok ? 'backend' : 'mock');
      notify(
        ok ? 'ok' : 'warn',
        ok ? 'Backend detectado' : 'Backend no disponible: modo mock',
        ok ? API_BASE : `Nada responde en ${API_BASE}. Se usa GeoJSON simulado hasta que arranques floodpulse-backend.`
      );
    });
  }, []);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      // Si hay al menos una fecha, esperar a que estén ambas
      if (eventStart || eventEnd) {
        if (!eventStart || !eventEnd) return; // Esperar
      }
      
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
          // Si hay fechas, forzamos modo historico anulando la lluvia manual
          const isHistorical = !!(eventStart && eventEnd);
          res = await fetchRisk(
            riskQueryFor(
              sector, 
              (isHistorical || realRain) ? null : rain,
              isHistorical ? eventStart : undefined,
              isHistorical ? eventEnd : undefined
            ), 
            ctrl.signal
          );
        } else {
          await new Promise((r) => setTimeout(r, 250));
          res = buildMockRisk(sector, realRain ? 12 : rain);
        }
        if (ctrl.signal.aborted) return;
        setData(res);

        if (source === 'backend') {
          const secs = res.timing_s?.total_s ?? Math.round((performance.now() - t0) / 1000);
          notify('ok', `Riesgo ${res.risk_score.toFixed(1)} en ${secs}s`, `${sector.sector} · ${res.grid_geojson.features.length} celdas`, { toast: false });
          for (const w of res.warnings ?? []) notify('warn', 'Aviso del backend', w);
          if (res.grid_geojson.features.length === 0) notify('warn', 'Grilla vacía', 'No hay celdas (¿mock_risk_api?).');
        }

        const st = enAlerta.current;
        const apiUmbral = res.alert_threshold ?? sector.umbral;
        const apiUmbralSalida = Math.max(0, apiUmbral - 6.16);
        if (res.risk_score < apiUmbralSalida) st[sector.sector] = false;
        else if (res.risk_score >= apiUmbral && !st[sector.sector]) {
          st[sector.sector] = true;
          setEvents((ev) => [{ at: new Date(), sector: sector.sector, score: res.risk_score }, ...ev].slice(0, 8));
          notify('error', `⚠ ${sector.sector} cruzó el umbral`, 'Alerta SMS disparada.', { ttl: 10000 });
        }
      } catch (e) {
        if (ctrl.signal.aborted) return;
        const msg = e instanceof Error ? e.message : String(e);
        const alive = source === 'backend' ? await backendAlive() : null;
        const why = explainFetchError(e, API_BASE, alive);
        setError(`${why.title}: ${why.detail}`);
        notify('error', why.title, why.detail, { ttl: 15000 });
        if (autoSource && source === 'backend' && alive === false) {
          setSource('mock');
        }
      } finally {
        clearInterval(tick);
        if (!ctrl.signal.aborted) {
          setLoading(false);
          setElapsed(0);
        }
      }
    },
    [sector, rain, realRain, source, autoSource, eventStart, eventEnd],
  );

  // Recalcular al cambiar sector / lluvia / fuente
  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  // Auto-refresh solo en modo lluvia real contra backend
  useEffect(() => {
    if (!(realRain && source === 'backend' && !eventStart)) return;
    const id = setInterval(() => void load({ silent: true }), AUTO_REFRESH_S * 1000);
    return () => clearInterval(id);
  }, [realRain, source, eventStart, load]);

  const score = data?.risk_score ?? 0;
  const currentUmbral = data?.alert_threshold ?? sector.umbral;
  const level = riskLevel(score, currentUmbral);
  const cruzado = score >= currentUmbral;
  
  const showPanel = !!data || !!clickedPoint;
  const isHistorical = !!(eventStart && eventEnd);

  return (
    <div className={`app level-${level}`}>
      <main className="main">
        <RiskMap 
          sector={sector} 
          grid={data?.grid_geojson ?? null} 
          loading={loading} 
          onMapClick={(lat, lon) => {
            setClickedPoint({lat, lon});
            setEventStart('');
            setEventEnd('');
            setRealRain(false);
          }}
          clickedPoint={clickedPoint}
        />
        <Toasts />
        <DebugPanel last={data} source={source} />

        {/* Buscador Flotante (Google Maps Style) */}
        <div className="floating-panel floating-top-left">
          <SearchBar onSelect={(s, eStart, eEnd) => {
            setClickedPoint(null);
            setEventStart(eStart || '');
            setEventEnd(eEnd || '');
            setSector(s); // Trigger load automatically
          }} />
        </div>

        {/* Panel Inferior Flotante */}
        {showPanel && (
          <div className={`floating-panel floating-bottom-left card risk risk-${level}`}>
            <header className="card-head">
              <h3>{clickedPoint ? `Ubicación: ${clickedPoint.lat.toFixed(4)}, ${clickedPoint.lon.toFixed(4)}` : sector.sector}</h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="ghost" 
                  style={{ padding: '4px 8px', borderRadius: '50%' }}
                  onClick={() => setMinimized(!minimized)}
                  title={minimized ? "Expandir" : "Minimizar"}
                >{minimized ? "▲" : "▼"}</button>
                <button 
                  className="ghost" 
                  style={{ padding: '4px 8px', borderRadius: '50%' }}
                  onClick={() => {
                     setClickedPoint(null); 
                     setData(null);
                     setSector(SECTOR_DEFAULT);
                     setEventStart('');
                     setEventEnd('');
                     setMinimized(false);
                  }}
                  title="Cerrar"
                >✕</button>
              </div>
            </header>

            {!minimized && (
              <>

            {clickedPoint ? (
              <div className="field">
                <p className="hint">Has seleccionado un punto personalizado. Haz clic abajo para descargar los datos de terreno (TWI, DEM) y evaluar el riesgo de inundación aquí.</p>
                <button 
                  onClick={() => {
                    setSector({
                      sector: `Coord: ${clickedPoint.lat.toFixed(4)}, ${clickedPoint.lon.toFixed(4)}`,
                      lat: clickedPoint.lat,
                      lon: clickedPoint.lon,
                      umbral: 31.16,
                      umbral_salida: 25,
                    });
                    setClickedPoint(null);
                  }}
                  style={{ marginTop: '8px' }}
                >
                  Analizar Riesgo Aquí
                </button>
              </div>
            ) : (
              <>
                <div className="score" style={{ color: riskColor(score, currentUmbral) }}>
                  {data ? score.toFixed(1) : '—'}
                  <small>/ 100 · umbral {currentUmbral}</small>
                </div>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${Math.min(score, 100)}%`, background: riskColor(score, currentUmbral) }} />
                  <div className="bar-threshold" style={{ left: `${currentUmbral}%` }} title={`Umbral ${currentUmbral}`} />
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
                    El monitor SMS dispara la alerta en su próximo ciclo.
                  </div>
                )}

                {/* Controles de Lluvia y Fecha integrados suavemente */}
                <details style={{ marginTop: '8px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                  <summary style={{ color: 'var(--muted)', fontSize: '13px', fontWeight: 600 }}>Parámetros de Lluvia y Fechas</summary>
                  
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="field">
                      <label>
                        <span>Fecha Inicio (Opcional - Histórico)</span>
                        <input type="date" value={eventStart} onChange={e => setEventStart(e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                      </label>
                    </div>
                    <div className="field">
                      <label>
                        <span>Fecha Fin (Opcional - Histórico)</span>
                        <input type="date" value={eventEnd} onChange={e => setEventEnd(e.target.value)} style={{ background: 'rgba(0,0,0,0.2)' }} />
                      </label>
                    </div>

                    {!isHistorical && (
                      <div className="field" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                        <label className="check">
                          <input type="checkbox" checked={realRain} onChange={e => setRealRain(e.target.checked)} />
                          <span>Usar clima real (Satélite + Pronóstico)</span>
                        </label>
                        {!realRain && (
                          <div style={{ marginTop: '8px' }}>
                            <div className="row">
                              <span className="hint">Simular lluvia manual</span>
                              <b>{rainDraft} mm</b>
                            </div>
                            <input
                              type="range" min={0} max={MAX_RAINFALL_MM} step={1} value={rainDraft}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setRainDraft(v);
                                if (rainTimer.current) clearTimeout(rainTimer.current);
                                rainTimer.current = setTimeout(() => setRain(v), source === 'backend' ? 700 : 150);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </details>

                <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                   <SubscribeForm sector={sector} />
                </div>
              </>
            )}
            
            {(loading || error) && (
              <footer className="status" style={{ marginTop: '12px' }}>
                {loading && <p className="hint">Calculando… {elapsed}s</p>}
                {error && <p className="hint warn">Error: {error}</p>}
              </footer>
            )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
