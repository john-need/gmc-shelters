import { useState, useMemo } from 'react';

const DEFAULT_PATHS = {
  DB_PATH: 'database/gmc_shelters.sqlite',
  SHELTERS_ROOT: 'shelters/',
  PHOTOS_PATH: 'shelters/<slug>/photos/',
};

function loadSaved() {
  try {
    const stored = localStorage.getItem('gmc.paths');
    return stored ? { ...DEFAULT_PATHS, ...JSON.parse(stored) } : { ...DEFAULT_PATHS };
  } catch {
    return { ...DEFAULT_PATHS };
  }
}

const PATH_LABELS: Record<string, { label: string; help: string }> = {
  DB_PATH: { label: 'Database', help: 'SQLite database file (relative to app root)' },
  SHELTERS_ROOT: { label: 'Shelters root', help: 'Parent folder for per-shelter directories' },
  PHOTOS_PATH: { label: 'Photos path', help: '<slug> is replaced per record at runtime' },
};

export default function PathsPage() {
  const [saved, setSaved] = useState(loadSaved);
  const [draft, setDraft] = useState(saved);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1600); };
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const set = (key: string, val: string) => setDraft((d: typeof DEFAULT_PATHS) => ({ ...d, [key]: val }));
  const save = () => {
    setSaved(draft);
    try { localStorage.setItem('gmc.paths', JSON.stringify(draft)); } catch {}
    flash('Paths saved');
  };
  const revert = () => setDraft(saved);
  const resetAll = () => setDraft({ ...DEFAULT_PATHS });

  return (
    <>
      <div className="settings-page-head">
        <div>
          <div
            className="settings-page-title"
            dangerouslySetInnerHTML={{ __html: 'Paths <em>· data locations</em>' }}
          />
          <div className="settings-page-sub">§ Settings / Paths</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetAll}>Reset all to defaults</button>
        </div>
      </div>

      <div className="settings-body">
        <div className="settings-card">
          <h3>Filesystem roots <em>· where the app reads &amp; writes</em></h3>
          <div className="desc">
            Paths are relative to the application root unless they start with{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>/</code> or{' '}
            <code style={{ fontFamily: 'var(--font-mono)' }}>~</code>.
            Changes apply on save and survive restart.
          </div>
          {Object.entries(PATH_LABELS).map(([key, { label, help }]) => (
            <div key={key} className="path-row">
              <div className="path-row-label">
                <div className="path-key">{key}</div>
                <div className="path-label-text">{label}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input
                  className="input mono"
                  value={(draft as Record<string, string>)[key]}
                  onChange={(e) => set(key, e.target.value)}
                  spellCheck={false}
                />
                <span className="help">{help}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="path-status-bar">
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--ink-3)', letterSpacing: '0.06em',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {dirty ? (
              <>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--rust)', display: 'inline-block' }}/>
                <span style={{ color: 'var(--rust)', fontWeight: 600 }}>Unsaved changes</span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17 19 7.5"/>
                </svg>
                <span>Paths saved</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={revert} disabled={!dirty}>Revert</button>
            <button className="btn primary" onClick={save} disabled={!dirty}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
              </svg>
              Save paths
            </button>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
