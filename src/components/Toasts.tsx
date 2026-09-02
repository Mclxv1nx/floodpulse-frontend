import { dismiss, useNotifications } from '@/lib/notify';

const ICON = { info: 'ℹ', ok: '✓', warn: '⚠', error: '✕' } as const;

/** Avisos flotantes (esquina superior derecha del mapa). Se cierran solos o con clic. */
export default function Toasts() {
  const { toasts } = useNotifications();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.level}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">{ICON[t.level]}</span>
          <div>
            <strong>{t.title}</strong>
            {t.detail && <p>{t.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
