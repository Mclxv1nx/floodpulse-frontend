# FloodPulse Frontend - instalacion en Windows
# Ejecutar desde esta carpeta:  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "No se encontro Node.js. Instala Node 18+ desde nodejs.org" -ForegroundColor Red; exit 1 }
node --version; npm --version
if (-not (Test-Path ".\.env")) { Copy-Item .env.example .env; Write-Host "Se creo .env" -ForegroundColor Yellow }
npm install
Write-Host ""
Write-Host "Listo. Arranca con:  npm run dev   ->  http://localhost:4321" -ForegroundColor Green
