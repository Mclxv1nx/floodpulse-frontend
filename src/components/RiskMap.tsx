import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RiskFeature, RiskGrid, Sector } from '@/lib/types';
import { riskColor, riskOpacity } from '@/lib/risk';

interface Props {
  sector: Sector;
  grid: RiskGrid | null;
  loading?: boolean;
}

/** Recentra el mapa cuando cambia el sector seleccionado */
function Recenter({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 15, { duration: 0.8 });
  }, [map, lat, lon]);
  return null;
}

export default function RiskMap({ sector, grid, loading }: Props) {
  const umbral = sector.umbral;

  const style = useMemo(
    () =>
      (feature?: RiskFeature): PathOptions => {
        const score = feature?.properties.risk_score ?? 0;
        return {
          color: '#0f172a',
          weight: 0.6,
          opacity: 0.5,
          fillColor: riskColor(score, umbral),
          fillOpacity: riskOpacity(score, umbral),
        };
      },
    [umbral],
  );

  const onEach = (feature: RiskFeature, layer: Layer) => {
    const p = feature.properties;
    layer.bindTooltip(
      `<b>Riesgo ${p.risk_score.toFixed(1)} / 100</b><br/>` +
        `TWI ${p.twi_raw} · cauce a ${p.dist_m} m · imperm. ${p.imperv_pct}%`,
      { sticky: true, direction: 'top', className: 'fp-tooltip' },
    );
  };

  // Clave que fuerza a react-leaflet a redibujar cuando cambia el grid (GeoJSON es inmutable)
  const gridKey = useMemo(() => {
    if (!grid) return 'empty';
    const sum = grid.features.reduce((acc, f) => acc + f.properties.risk_score, 0);
    return `${sector.sector}-${grid.features.length}-${sum.toFixed(2)}-${umbral}`;
  }, [grid, sector.sector, umbral]);

  return (
    <div className={`map-wrap ${loading ? 'is-loading' : ''}`}>
      <MapContainer
        center={[sector.lat, sector.lon]}
        zoom={15}
        scrollWheelZoom
        className="map"
        preferCanvas
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter lat={sector.lat} lon={sector.lon} />
        {grid && grid.features.length > 0 && (
          <GeoJSON key={gridKey} data={grid as never} style={style as never} onEachFeature={onEach as never} />
        )}
        <CircleMarker
          center={[sector.lat, sector.lon]}
          radius={7}
          pathOptions={{ color: '#0ea5e9', fillColor: '#38bdf8', fillOpacity: 1, weight: 2 }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent>
            {sector.sector}
          </Tooltip>
        </CircleMarker>
      </MapContainer>

      {loading && (
        <div className="map-loading">
          <span className="spinner" />
          Calculando riesgo hiperlocal…
        </div>
      )}

      <div className="legend">
        <span><i style={{ background: '#22c55e' }} /> &lt; 30 bajo</span>
        <span><i style={{ background: '#f59e0b' }} /> 30 – {umbral} medio</span>
        <span><i style={{ background: '#ef4444' }} /> ≥ {umbral} alerta SMS</span>
      </div>
    </div>
  );
}
