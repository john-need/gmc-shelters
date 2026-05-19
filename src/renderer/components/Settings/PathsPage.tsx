import { useMemo, useState } from 'react';
import { DEFAULT_PATHS, loadStoredPaths } from '../../pathSettings';

type PathSettings = typeof DEFAULT_PATHS;

const SQLITE_FILE_RE = /\.(sqlite|sqlite3|db)$/i;

const PATH_LABELS: Record<string, { label: string; help: string }> = {
  DB_PATH: { label: 'Database', help: 'Existing SQLite database file (.sqlite, .sqlite3, or .db)' },
  SHELTERS_ROOT: { label: 'Shelters root', help: 'Existing parent folder for per-shelter directories and photos' },
};

export default function PathsPage() {
  const [saved, setSaved] = useState(loadStoredPaths);
  const [draft, setDraft] = useState(saved);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browsingKey, setBrowsingKey] = useState<keyof PathSettings | null>(null);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 1600); };
  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const set = (key: keyof PathSettings, val: string) => {
    setError(null);
    setDraft((d) => ({ ...d, [key]: val }));
  };

  const browse = async (key: keyof PathSettings) => {
    setError(null);
    setBrowsingKey(key);
    try {
      const selected = key === 'DB_PATH'
        ? await window.api.app.browseForDatabasePath(draft.DB_PATH)
        : await window.api.app.browseForDirectoryPath(draft.SHELTERS_ROOT);

      if (selected) {
        setDraft((current) => ({ ...current, [key]: selected }));
      }
    } finally {
      setBrowsingKey(null);
    }
  };

  const save = async () => {
    const next = {
      DB_PATH: draft.DB_PATH.trim(),
      SHELTERS_ROOT: draft.SHELTERS_ROOT.trim(),
    };

    if (!next.DB_PATH || !next.SHELTERS_ROOT) {
      setError('Database and shelters root are both required.');
      return;
    }

    if (!SQLITE_FILE_RE.test(next.DB_PATH)) {
      setError('Database must end in .sqlite, .sqlite3, or .db.');
      return;
    }

    const [dbPath, sheltersRoot] = await Promise.all([
      window.api.app.validatePath(next.DB_PATH),
      window.api.app.validatePath(next.SHELTERS_ROOT),
    ]);

    if (!dbPath.exists || !dbPath.isFile) {
      setError('Database must point to an existing SQLite file.');
      return;
    }

    if (!sheltersRoot.exists || !sheltersRoot.isDirectory) {
      setError('Shelters root must point to an existing folder.');
      return;
    }

    setDraft(next);
    setSaved(next);
    try { localStorage.setItem('gmc.paths', JSON.stringify(next)); } catch {}
    setError(null);
    flash('Paths saved');
  };
  const revert = () => {
    setError(null);
    setDraft(saved);
  };
  const resetAll = () => {
    setError(null);
    setDraft({ ...DEFAULT_PATHS });
  };

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
            Changes apply on save and survive restart. Shelter photos are always read beneath the shelters root;
            there is no separate photos root setting.
          </div>
          {Object.entries(PATH_LABELS).map(([key, { label, help }]) => (
            <div key={key} className="path-row">
              <div className="path-row-label">
                <div className="path-key">{key}</div>
                <div className="path-label-text">{label}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div className="path-control-row">
                  <input
                    className="input mono"
                    value={draft[key as keyof PathSettings]}
                    onChange={(e) => set(key as keyof PathSettings, e.target.value)}
                    spellCheck={false}
                  />
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void browse(key as keyof PathSettings)}
                    disabled={browsingKey !== null}
                    aria-label={`Browse for ${label.toLowerCase()}`}
                  >
                    {browsingKey === key ? 'Browsing...' : 'Browse'}
                  </button>
                </div>
                <span className="help">{help}</span>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="settings-inline-error">{error}</div>}
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
            <button className="btn primary" onClick={() => void save()} disabled={!dirty || browsingKey !== null}>
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
