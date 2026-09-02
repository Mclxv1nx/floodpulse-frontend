import { useEffect, useState } from 'react';
import { listSuscriptores, subsAlive, subscribe, type SuscriptorMasked } from '@/lib/api';
import type { Sector } from '@/lib/types';

interface Props {
  sector: Sector;
}

/**
 * Alta de teléfonos en la API de suscriptores (floodpulse-alerts, puerto 8100).
 * El monitor SMS relee la base en cada ciclo, así que el alta entra sin reiniciar nada.
 */
export default function SubscribeForm({ sector }: Props) {
  const [telefono, setTelefono] = useState('+593');
  const [consent, setConsent] = useState(false);
  const [estado, setEstado] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [mensaje, setMensaje] = useState('');
  const [online, setOnline] = useState<boolean | null>(null);
  const [lista, setLista] = useState<SuscriptorMasked[]>([]);

  async function refrescar() {
    const alive = await subsAlive();
    setOnline(alive);
    if (!alive) return;
    try {
      setLista(await listSuscriptores(sector.sector));
    } catch {
      setLista([]);
    }
  }

  useEffect(() => {
    void refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector.sector]);

  async function onSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!consent) {
      setEstado('error');
      setMensaje('Se requiere el consentimiento del titular.');
      return;
    }
    setEstado('sending');
    setMensaje('');
    try {
      const r = await subscribe(telefono.trim(), sector.sector);
      setEstado('ok');
      setMensaje(`Registrado ${r.telefono} en ${r.sector}.`);
      setTelefono('+593');
      setConsent(false);
      await refrescar();
    } catch (err) {
      setEstado('error');
      setMensaje(err instanceof Error ? err.message : 'Error desconocido');
    }
  }

  return (
    <section className="card">
      <header className="card-head">
        <h3>Recibir alertas por SMS</h3>
        <span className={`dot ${online ? 'on' : online === false ? 'off' : ''}`} title="API de suscriptores" />
      </header>

      {online === false && (
        <p className="hint warn">
          API de suscriptores no responde. Levántala con <code>python run.py</code> → opción 3 en <code>floodpulse-alerts</code>.
        </p>
      )}

      <form onSubmit={onSubmit} className="form">
        <label>
          Teléfono (Ecuador)
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="+593987654321"
            pattern="^\+593[0-9]{9}$"
            title="Formato +593XXXXXXXXX"
            required
            disabled={online === false}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Autorizo recibir alertas de inundación para <b>{sector.sector}</b>.
        </label>
        <button type="submit" disabled={estado === 'sending' || online === false}>
          {estado === 'sending' ? 'Registrando…' : 'Suscribirme'}
        </button>
        {mensaje && <p className={`hint ${estado === 'error' ? 'warn' : 'ok'}`}>{mensaje}</p>}
      </form>

      {lista.length > 0 && (
        <ul className="subs">
          {lista.map((s) => (
            <li key={s.telefono + s.alta}>
              <span>{s.telefono}</span>
              <small>{new Date(s.alta).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
