import { useState, useMemo, useEffect } from 'react';
import { DEFAULT_PUBLISHING, loadStoredPublishing } from '../../publishSettings';

const SCOPE_PRESETS = [
  { url: 'https://www.googleapis.com/auth/drive', label: 'drive (full)' },
  { url: 'https://www.googleapis.com/auth/drive.file', label: 'drive.file' },
  { url: 'https://www.googleapis.com/auth/drive.readonly', label: 'drive.readonly' },
  { url: 'https://www.googleapis.com/auth/drive.metadata', label: 'drive.metadata' },
  { url: 'https://www.googleapis.com/auth/drive.appdata', label: 'drive.appdata' },
];

export default function PublishingPage() {
  const [saved, setSaved] = useState(loadStoredPublishing);
  const [draft, setDraft] = useState(saved);
  const [toast, setToast] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [credentials, setCredentials] = useState<{ exists: boolean; path: string } | null>(null);
  const [importingCredentials, setImportingCredentials] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  };

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);
  const set = (key: string, val: unknown) => setDraft((d: typeof DEFAULT_PUBLISHING) => ({ ...d, [key]: val }));

  useEffect(() => {
    window.api.publish.checkCredentials().then(setCredentials).catch(() => {});
  }, []);

  const save = () => {
    setSaved(draft);
    try { localStorage.setItem('gmc.publishing', JSON.stringify(draft)); } catch {}
    flash('Publishing config saved');
  };
  const revert = () => setDraft(saved);
  const resetAll = () => setDraft({ ...DEFAULT_PUBLISHING });

  const handleImportCredentials = async () => {
    setImportingCredentials(true);
    try {
      const result = await window.api.publish.importCredentials();
      if (result === null) return; // cancelled
      setCredentials({ exists: result.ok, path: result.path });
      if (result.ok) {
        flash('credentials.json installed');
        setConnectionStatus(null);
      } else {
        flash(`Failed to import: ${result.message ?? 'unknown error'}`);
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    } finally {
      setImportingCredentials(false);
    }
  };

  const handleTestConnection = async () => {
    if (!draft.ROOT_FOLDER_ID) {
      setConnectionStatus({ ok: false, message: 'ROOT_FOLDER_ID is not configured.' });
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const result = await window.api.publish.testConnection({
        rootFolderId: draft.ROOT_FOLDER_ID,
        scopes: draft.SCOPES,
      });
      if ('error' in result) {
        setConnectionStatus({ ok: false, message: String(result.error) });
      } else {
        setConnectionStatus(result);
      }
    } catch (err) {
      setConnectionStatus({ ok: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setTestingConnection(false);
    }
  };

  type Draft = typeof DEFAULT_PUBLISHING;
  const setScope = (i: number, val: string) =>
    setDraft((d: Draft) => ({ ...d, SCOPES: d.SCOPES.map((s: string, idx: number) => (idx === i ? val : s)) }));
  const removeScope = (i: number) =>
    setDraft((d: Draft) => ({ ...d, SCOPES: d.SCOPES.filter((_: string, idx: number) => idx !== i) }));
  const addScope = (val = '') => setDraft((d: Draft) => ({ ...d, SCOPES: [...d.SCOPES, val] }));
  const addPreset = (url: string) => {
    if (draft.SCOPES.includes(url)) return;
    addScope(url);
  };

  return (
    <>
      <div className="settings-page-head">
        <div>
          <div
            className="settings-page-title"
            dangerouslySetInnerHTML={{ __html: 'Publishing <em>· web output</em>' }}
          />
          <div className="settings-page-sub">§ Settings / Publishing</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={resetAll}>Reset to defaults</button>
          <button className="btn" onClick={handleTestConnection} disabled={testingConnection}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            {testingConnection ? 'Testing…' : 'Test connection'}
          </button>
        </div>
      </div>
      {connectionStatus && (
        <div style={{
          marginTop: 8,
          padding: '6px 12px',
          borderRadius: 6,
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
          background: connectionStatus.ok ? 'var(--ok-bg, #d4edda)' : 'var(--err-bg, #f8d7da)',
          color: connectionStatus.ok ? 'var(--ok, #155724)' : 'var(--err, #721c24)',
          border: `1px solid ${connectionStatus.ok ? 'var(--ok-border, #c3e6cb)' : 'var(--err-border, #f5c6cb)'}`,
        }}>
          {connectionStatus.ok ? '✓' : '✗'} {connectionStatus.message}
        </div>
      )}

      <div className="settings-body">
        <div className="settings-card">
          <h3>credentials.json <em>· OAuth2 key</em></h3>
          <div className="desc">
            Download this file from Google Cloud Console → APIs &amp; Services → Credentials (Desktop app type).
            It is stored in the app data directory and never committed to the repository.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
            <button className="btn" onClick={handleImportCredentials} disabled={importingCredentials}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              {importingCredentials ? 'Selecting…' : 'Browse for credentials.json'}
            </button>
            {credentials !== null && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: credentials.exists ? 'var(--ok, #155724)' : 'var(--err, #721c24)',
              }}>
                {credentials.exists ? '✓ found' : '✗ not found'}
              </span>
            )}
          </div>
          {credentials !== null && (
            <div style={{
              marginTop: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              wordBreak: 'break-all',
            }}>
              {credentials.path}
            </div>
          )}
        </div>

        <div className="settings-card">
          <h3>Google Drive target <em>· where the manifest lives</em></h3>
          <div className="desc">
            The Publish-to-web action uploads the generated archive to a Drive folder.
            Get the <strong>ROOT_FOLDER_ID</strong> from the URL of the destination folder in Drive.
          </div>
          <div className="pub-fields">
            <div className="pub-field col-2">
              <div className="label-mono">
                <span>ROOT_FOLDER_ID</span>
                <span className={`badge ${draft.ROOT_FOLDER_ID ? 'set' : 'empty'}`}>
                  {draft.ROOT_FOLDER_ID ? 'configured' : 'unset'}
                </span>
              </div>
              <input
                className="input mono"
                value={draft.ROOT_FOLDER_ID}
                onChange={(e) => set('ROOT_FOLDER_ID', e.target.value)}
                placeholder="1a2B3cD4eF5g…  (paste folder ID from Drive URL)"
                spellCheck={false}
              />
              <span className="help">
                The ID at the end of{' '}
                <code style={{ fontFamily: 'var(--font-mono)' }}>
                  drive.google.com/drive/folders/<strong>ID</strong>
                </code>.
              </span>
            </div>
<div className="pub-field col-2">
              <div className="label-mono">
                <span>MANIFEST_NAME</span>
                <span className="badge">filename</span>
              </div>
              <input
                className="input mono"
                value={draft.MANIFEST_NAME}
                onChange={(e) => set('MANIFEST_NAME', e.target.value)}
                placeholder="shelter-manifest.json"
                spellCheck={false}
              />
              <span className="help">
                JSON manifest the build emits — lists every shelter, photos, sources, and markers.
              </span>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3>OAuth scopes <em>· Google API authorization</em></h3>
          <div className="desc">
            Scopes requested when authenticating with Google. Use the most narrow scope sufficient for your workflow.
          </div>
          <div className="pub-field">
            <div className="label-mono">
              <span>SCOPES <span style={{ color: 'var(--ink-4)', fontWeight: 400, marginLeft: 6 }}>({draft.SCOPES.length})</span></span>
            </div>
            <div className="scope-list">
              {draft.SCOPES.length === 0 && (
                <span className="scope-empty">No scopes — Drive operations will fail.</span>
              )}
              {draft.SCOPES.map((s: string, i: number) => (
                <div key={i} className="scope-row">
                  <input
                    className="input mono"
                    value={s}
                    onChange={(e) => setScope(i, e.target.value)}
                    placeholder="https://www.googleapis.com/auth/…"
                    spellCheck={false}
                  />
                  <button className="btn icon sm" title="Remove scope" onClick={() => removeScope(i)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              ))}
              <button className="add-scope-btn" onClick={() => addScope('')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add scope
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'var(--ink-3)', marginBottom: 4,
              }}>Presets</div>
              <div className="preset-row">
                {SCOPE_PRESETS.map((p) => (
                  <button
                    key={p.url}
                    className="preset-chip"
                    onClick={() => addPreset(p.url)}
                    disabled={draft.SCOPES.includes(p.url)}
                    style={draft.SCOPES.includes(p.url) ? { opacity: 0.4, cursor: 'default' } : undefined}
                    title={p.url}
                  >
                    + {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
                <span>· will write to <code style={{ fontFamily: 'var(--font-mono)' }}>publishing.config.json</code></span>
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17 19 7.5"/>
                </svg>
                <span>Publishing config saved</span>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={revert} disabled={!dirty}>Revert</button>
            <button className="btn primary" onClick={save} disabled={!dirty}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
              </svg>
              Save config
            </button>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}
