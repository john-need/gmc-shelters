import { useRef, useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { showToast } from '../../store/uiSlice';

interface Props {
  onNewShelter: () => void;
  onOpenSettings: (page: string) => void;
}

export default function AppHeader({ onNewShelter, onOpenSettings }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const count = useSelector((s: RootState) => s.shelters.list.length);
  const [menuOpen, setMenuOpen] = useState(false);
  const btnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpen]);

  const openPage = (page: string) => {
    setMenuOpen(false);
    onOpenSettings(page);
  };

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

      {/* Settings cog */}
      <div className="settings-wrap" ref={btnRef}>
        <button
          className="btn icon"
          title="Settings"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {/* Cog icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        {menuOpen && (
          <div className="settings-menu">
            <div className="settings-menu-header">Settings</div>
            <button className="settings-menu-item" onClick={() => openPage('publishing')}>
              <span className="ico">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                  <line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </span>
              <span className="text">
                <span className="title">Publishing</span>
                <span className="sub">Site &amp; deploy</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <button className="settings-menu-item" onClick={() => openPage('architectures')}>
              <span className="ico">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                </svg>
              </span>
              <span className="text">
                <span className="title">Architectures</span>
                <span className="sub">Type taxonomy</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <button className="settings-menu-item" onClick={() => openPage('categories')}>
              <span className="ico">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h7"/>
                </svg>
              </span>
              <span className="text">
                <span className="title">Shelter categories</span>
                <span className="sub">Type classification</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <button className="settings-menu-item" onClick={() => openPage('paths')}>
              <span className="ico">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <span className="text">
                <span className="title">Paths</span>
                <span className="sub">Data locations</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
            <button className="settings-menu-item" onClick={() => openPage('about')}>
              <span className="ico">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
              </span>
              <span className="text">
                <span className="title">About</span>
                <span className="sub">Version &amp; credits</span>
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 'auto', color: 'var(--ink-4)' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      <button className="btn primary" onClick={onNewShelter}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        New shelter
      </button>
    </header>
  );
}
