# FloodPulse — Guía de arranque del ecosistema completo (Windows)

Tres repos, tres procesos. Orden recomendado: **backend → alertas → frontend**.
Todo se prueba con `rainfall_mm` forzado, así **no necesitas Google Earth Engine**.

```
C:\Users\Usuario\Documents\GitHub\
├── floodpulse-backend    Motor 1: GET /risk  (puerto 8000)
├── floodpulse-alerts     Motor 2: monitor SMS + API suscriptores (puerto 8100)
└── floodpulse-frontend   Dashboard Astro + Leaflet (puerto 4321)
```

> Si PowerShell se queja de "la ejecución de scripts está deshabilitada", ejecuta
> los scripts como `powershell -ExecutionPolicy Bypass -File .\setup.ps1`.

---

## 1. Backend (motor de riesgo)

```powershell
cd C:\Users\Usuario\Documents\GitHub\floodpulse-backend
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # venv + pip install + descarga WhiteboxTools
powershell -ExecutionPolicy Bypass -File .\start.ps1     # uvicorn en http://localhost:8000
```

En **otra** ventana, prueba que calcula (la primera vez tarda 30–90 s porque
descarga el DEM y la cobertura de suelo y corre WhiteboxTools):

```powershell
powershell -ExecutionPolicy Bypass -File .\smoke_test.ps1
```

Deberías ver `risk_score = 6x.xx   celdas = 121` aprox. Swagger: http://localhost:8000/docs

**Qué cambié en el backend (2 cosas pequeñas, avísale a Said):**

- `src/main.py`: agregué `CORSMiddleware` (sin esto el navegador bloquea las
  llamadas del dashboard a `/risk`) y un `GET /health` para que el dashboard y el
  monitor detecten si el motor está vivo.
- Nuevos archivos `setup.ps1`, `start.ps1`, `smoke_test.ps1` (solo utilidades).

**Problemas típicos:**

| Síntoma | Causa / solución |
|---|---|
| `pip install` falla en `rasterio`/`geopandas` | Usa Python 3.11 o 3.12 (64 bits). Con 3.13+ a veces faltan wheels. |
| Primera llamada a `/risk` se queda pensando | Normal: WhiteboxTools + descarga satelital. Espera hasta 2 min. |
| `Error fetching satellite data` | Sin internet o Planetary Computer bloqueado por el firewall/antivirus. |
| `OSM Timeout` | Overpass caído: reintenta. Para Ajaví siempre pasa `fallback_waterway_coords`. |
| `Error inicializando Google Earth Engine` | Solo pasa si NO envías `rainfall_mm`. Para la demo, siempre envíalo (el dashboard lo hace por ti). |

---

## 2. Alertas (monitor SMS + API de suscriptores)

```powershell
cd C:\Users\Usuario\Documents\GitHub\floodpulse-alerts
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # venv + pip install (+ crea .env si falta)
powershell -ExecutionPolicy Bypass -File .\start.ps1     # menú: python run.py
```

Ya dejé un `.env` de desarrollo listo (`API_KEY=floodpulse-dev-key`, `API_BASE=http://localhost:8000`).

Menú de `run.py`:

1. **Monitor** — consulta `/risk` de cada sector de `suscriptores.json` cada 15 min y
   encola SMS si cruza el umbral. `DRY_RUN = True` por defecto (solo imprime).
2. **Calibrar** — barre lluvia 0→25 mm contra el backend real para ver a qué mm
   cruza cada sector. **Hazlo una vez con el backend levantado** y ajusta `umbral`
   en `suscriptores.json`.
3. **API de suscriptores** — http://localhost:8100/docs. **Necesaria para el dashboard.**
4. **Mock de la API de riesgo** — sustituto del backend en el puerto 8000 (no usar
   si el backend real está corriendo: mismo puerto).
5. Levantar todo (3 + 1 en ventanas aparte).
6. Diagnóstico.

Para probar rápido el ciclo completo sin esperar 15 min, en `alerta_sms.py`
cambia temporalmente `POLL_SEGUNDOS = 60` y `RAINFALL_MM = 25`.

**Ojo con los umbrales:** con `RAINFALL_MM = 20` y `umbral = 70`, Malacatos en el
mock da 67 → nunca alerta. O subes la lluvia a 25 o bajas el umbral tras calibrar.

**Qué cambié en alertas:**

- `suscriptores.json`: agregué **Ajaví, Ibarra** (con `fallback_waterway_coords`)
  y **Guayaquil (Centro)** para que coincidan con los sectores del dashboard.
- `mock_risk_api.py`: cabecera CORS + `/health` (para poder usar el mock desde el navegador).
- `.env` (no se sube a git), `setup.ps1`, `start.ps1`.

---

## 3. Frontend (dashboard)

```powershell
cd C:\Users\Usuario\Documents\GitHub\floodpulse-frontend
powershell -ExecutionPolicy Bypass -File .\setup.ps1     # npm install + .env
npm run dev                                              # http://localhost:4321
```

- Sin backend → **modo mock** automático (grilla simulada con la misma fórmula).
- Con backend en 8000 → **backend real**: el slider de lluvia envía `rainfall_mm`
  y el mapa repinta cada celda de 100 m (verde < 30, amarillo 30–70, rojo ≥ 70).
- Con la API de suscriptores en 8100 → el formulario da de alta teléfonos que el
  monitor recoge en su siguiente ciclo (sin reiniciar nada).

`npm run build` compila y hace `astro check` (tipos); sube `dist/` a Vercel con las
variables `PUBLIC_*` apuntando a la URL pública del backend (ngrok).

---

## 4. Demo "efecto wow" (Día 3 de la guía)

Ventanas abiertas: backend (8000), API suscriptores (8100), monitor (DRY_RUN o
gateway Termux), dashboard (4321).

1. En el dashboard elige **Malacatos, Loja**, registra el teléfono de prueba.
2. Arrastra el slider de lluvia de 0 → 25 mm. Al cruzar 70 la celda se pone roja y
   aparece el banner *Umbral superado*.
3. El monitor, en su siguiente ciclo (`POLL_SEGUNDOS`), consulta el mismo `/risk`
   con el mismo `RAINFALL_MM` → encola el SMS → gateway Termux → llega al teléfono.

> Para que el número del monitor coincida con lo que ve el público, pon en
> `alerta_sms.py` el mismo `RAINFALL_MM` que dejas en el slider (25).

---

## Chequeo rápido de puertos

```powershell
Invoke-RestMethod http://localhost:8000/health     # {"ok":true,"servicio":"riesgo"}
Invoke-RestMethod http://localhost:8100/health     # {"ok":true,"servicio":"suscriptores"}
Start-Process http://localhost:4321
```
