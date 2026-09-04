# FloodPulse — Frontend (Dashboard)

Dashboard del sistema FloodPulse (HackTech El Niño 2026 — Track 1). Muestra el
índice de riesgo de inundación hiperlocal por celdas de 100 × 100 m que calcula el
[backend](https://github.com/1Said2/floodpulse-backend) y permite registrar
teléfonos en la API de suscriptores del
[módulo de alertas SMS](../floodpulse-alerts).

**Stack:** Astro 5 + React 19 + TypeScript + React-Leaflet. Deploy estático (Vercel).

## Arranque rápido

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1   # npm install + .env
npm run dev                                            # http://localhost:4321
```

Sin backend levantado, el dashboard funciona en **modo mock** (GeoJSON simulado
con la misma fórmula del backend). Cuando `http://localhost:8000` responde, pasa
solo a **backend real**. La fuente se puede forzar abajo del panel lateral.

## Variables de entorno (`.env`)

| Variable | Default | Para qué |
|---|---|---|
| `PUBLIC_API_BASE` | `http://localhost:8000` | Motor de riesgo (`GET /risk`) |
| `PUBLIC_SUBS_API_BASE` | `http://localhost:8100` | API de suscriptores del módulo de alertas |
| `PUBLIC_SUBS_API_KEY` | `floodpulse-dev-key` | Debe coincidir con `API_KEY` de `floodpulse-alerts/.env` |

## Estructura

```
src/
  components/
    Dashboard.tsx      estado global: sector, lluvia simulada, fuente, alertas
    RiskMap.tsx        mapa Leaflet, colorea cada celda por risk_score
    SubscribeForm.tsx  alta de teléfonos (POST /suscriptores)
  lib/
    types.ts           contrato de datos con /risk (RiskResponse, Sector...)
    api.ts             fetch al backend y a la API de suscriptores
    mock.ts            generador de GeoJSON simulado (misma fórmula del backend)
    risk.ts            umbrales y colores dinámicos (<70% umbral verde, 70%-100% amarillo, ≥umbral rojo)
    sectores.ts        sectores de la demo (espejo de suscriptores.json)
  pages/index.astro    página única; el Dashboard se hidrata con client:only
```

## Lógica de colores (igual que el monitor SMS)

Un sector "cruza" cuando `risk_score ≥ umbral` del sector (ej. 31.16). En ese
instante la celda se pinta roja, aparece el banner de alerta y `alerta_sms.py`
—que consulta el mismo `/risk`— encola el SMS. Se aplica la misma histéresis:
no se repite la alerta hasta que el score baje de `umbral_salida`.

## Deploy en Vercel

`npm run build` genera `dist/`. En Vercel: framework *Astro*, y definir las tres
variables `PUBLIC_*` apuntando a la URL pública del backend (ngrok o servidor).
