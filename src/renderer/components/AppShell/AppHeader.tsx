import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { showToast } from '../../store/uiSlice';

interface Props {
  onNewShelter: () => void;
}

export default function AppHeader({ onNewShelter }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const count = useSelector((s: RootState) => s.shelters.list.length);

  const handlePublish = () => {
    dispatch(showToast({ id: Date.now().toString(), message: 'Publishing to web…' }));
  };

  const handleExport = () => {
    dispatch(showToast({ id: Date.now().toString(), message: 'Export not yet implemented.' }));
  };

  return (
    <header className="app-header">
      <div className="app-brand">
        <div className="app-logo">G</div>
        <div className="app-brand-text">
          <div className="app-brand-name">GMC Shelters</div>
          <div className="app-brand-sub">Archive · v1.4.0</div>
        </div>
      </div>

      <div className="header-divider" />

      <div className="header-search">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input placeholder="Search records, photographers, slugs…" readOnly />
        <kbd>⌘K</kbd>
      </div>

      <div className="header-spacer" />

      <div className="header-meta">
        <span className="dot" />
        <span>DB · {count} records</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span>FS · sync&apos;d</span>
      </div>

      <div className="header-divider" />

      <button className="btn" onClick={handleExport}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>
        </svg>
        Export
      </button>
      <button className="btn rust" onClick={handlePublish}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
        </svg>
        Publish to web
      </button>
      <button className="btn primary" onClick={onNewShelter}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New shelter
      </button>
    </header>
  );
}
