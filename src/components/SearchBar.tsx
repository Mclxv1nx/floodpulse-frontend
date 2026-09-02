import { useState, useRef, useEffect } from 'react';
import type { Sector } from '@/lib/types';
import { SECTORES } from '@/lib/sectores';

interface Props {
  onSelect: (sector: Sector, eventStart?: string, eventEnd?: string) => void;
}

type Suggestion = {
  type: 'sector' | 'event';
  label: string;
  sublabel?: string;
  sector: Sector;
  eventStart?: string;
  eventEnd?: string;
};

export default function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generar lista plana de sugerencias (sectores)
  const allSuggestions: Suggestion[] = [];
  for (const s of SECTORES) {
    allSuggestions.push({ type: 'sector', label: s.sector, sublabel: s.descripcion, sector: s });
  }

  const filtered = query
    ? allSuggestions.filter((s) =>
        (s.label + ' ' + (s.sublabel || '')).toLowerCase().includes(query.toLowerCase())
      )
    : allSuggestions;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className="search-bar-container" style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(17, 26, 46, 0.85)', backdropFilter: 'blur(16px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, marginRight: '8px' }}>
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          placeholder="Buscar un lugar o evento histórico..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          style={{ background: 'transparent', border: 'none', outline: 'none', padding: '8px 0', fontSize: '14px', flex: 1 }}
        />
        {query && (
          <button className="ghost" style={{ padding: '4px', border: 'none' }} onClick={() => setQuery('')}>
            ✕
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: 'rgba(17, 26, 46, 0.95)', backdropFilter: 'blur(16px)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 2000 }}>
          {filtered.map((s, i) => (
            <div
              key={i}
              onClick={() => {
                onSelect(s.sector, s.eventStart, s.eventEnd);
                setQuery(s.label);
                setOpen(false);
              }}
              style={{ padding: '10px 14px', borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {s.type === 'event' ? '⏱' : '📍'}
                <span style={{ fontWeight: 600, color: '#e5ecf6' }}>{s.label}</span>
              </div>
              {s.sublabel && <small style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', marginLeft: '22px' }}>{s.sublabel}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
