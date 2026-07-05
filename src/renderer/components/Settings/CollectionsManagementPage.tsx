import {useCallback, useEffect, useRef, useState} from 'react';
import type {
    CollectionsProgress,
    CollectionsRunMode,
    CollectionStatus,
    SourceType,
    WikiHeaderPreserved,
    WikiIndexReport,
} from '../../../shared/ipc-types';
import {
    HEADER_PROPERTIES,
    HEADER_PROPERTY_CONTROL,
    HEADER_SCHEMA,
    SOURCE_TYPES,
    validateHeader,
} from '../../../shared/wiki-header-schema';

const STATUS_LABEL: Record<string, string> = {
    missing: 'needs addition',
    raw: 'needs cleanup',
    clean: 'cleaned',
};

type PendingRun = {
    mode: CollectionsRunMode;
    all: string[];      // repo-relative selected paths
    pending: string[];  // subset that actually needs this operation
};

export default function CollectionsManagementPage() {
    return (
        <>
            <div className="settings-page-head">
                <div>
                    <div
                        className="settings-page-title"
                        dangerouslySetInnerHTML={{__html: 'Collections Management <em>· wiki &amp; AI</em>'}}
                    />
                    <div className="settings-page-sub">§ Settings / Collections Management</div>
                </div>
            </div>

            <div className="settings-body">
                <CollectionsCard/>
                <ApiKeyCard/>
            </div>
        </>
    );
}

function CollectionsCard() {
    const [collections, setCollections] = useState<CollectionStatus[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [pendingRun, setPendingRun] = useState<PendingRun | null>(null);
    const [running, setRunning] = useState(false);
    const [progress, setProgress] = useState<CollectionsProgress | null>(null);
    const [summary, setSummary] = useState<string | null>(null);
    const [needsApiKey, setNeedsApiKey] = useState(false);
    const [liveLabel, setLiveLabel] = useState<Record<string, string>>({});
    const [indexReport, setIndexReport] = useState<WikiIndexReport | null>(null);
    const [headerEdit, setHeaderEdit] = useState<{ path: string; notAdded: boolean } | null>(null);
    const runRef = useRef<{ mode: CollectionsRunMode; files: string[] }>({mode: 'add', files: []});

    const refresh = useCallback(() => {
        window.api.collections.status().then(setCollections);
        window.api.wiki.indexReport().then(setIndexReport);
    }, []);

    useEffect(refresh, [refresh]);

    useEffect(() => window.api.collections.onProgress((p) => {
        setProgress(p);
        if (!p.file) return;
        const path = runRef.current.files.find((f) => f.endsWith('/' + p.file));
        if (!path) return;
        setLiveLabel((prev) => {
            const next = {...prev};
            if (p.kind === 'proc') next[path] = runRef.current.mode === 'clean' ? 'cleaning' : 'adding';
            else if (p.kind === 'ok' || p.kind === 'cache') {
                next[path] = runRef.current.mode === 'clean' ? STATUS_LABEL.clean : STATUS_LABEL.raw;
            } else delete next[path];
            return next;
        });
    }), []);

    const relPath = (coll: string, file: string) => `collections/${coll}/${file}`;

    const toggle = (path: string) => {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    };

    const toggleCollection = (c: CollectionStatus) => {
        const paths = c.files.map((f) => relPath(c.name, f.name));
        setSelected((s) => {
            const next = new Set(s);
            const allIn = paths.every((p) => next.has(p));
            paths.forEach((p) => (allIn ? next.delete(p) : next.add(p)));
            return next;
        });
    };

    const statusOf = (path: string): string => {
        for (const c of collections) {
            for (const f of c.files) {
                if (relPath(c.name, f.name) === path) return f.status;
            }
        }
        return 'missing';
    };

    const openHeaderEditor = (path: string) => {
        setHeaderEdit({path, notAdded: statusOf(path) === 'missing'});
    };

    const setCollectionCitationType = async (name: string, citationType: string) => {
        await window.api.collections.setCitationType(name, citationType);
        refresh();
    };

    const execute = async (mode: CollectionsRunMode, files: string[], force: boolean) => {
        setPendingRun(null);
        setRunning(true);
        setSummary(null);
        runRef.current = {mode, files};
        setLiveLabel({});
        try {
            const result = await window.api.collections.run({mode, files: files.sort(), force});
            if (result.canceled) setSummary('Run canceled — finished files were kept.');
            else if (!result.ok) setSummary(`Run failed: ${result.error ?? 'unknown error'}`);
            else setSummary(`Done: ${result.converted} converted, ${result.cached} cached, ${result.failed} failed.`);
        } finally {
            setRunning(false);
            setProgress(null);
            runRef.current = {mode, files: []};
            setLiveLabel({});
            refresh();
        }
    };

    const requestRun = async (mode: CollectionsRunMode) => {
        if (mode === 'clean') {
            const key = await window.api.ai.getApiKey();
            if (!key) {
                setNeedsApiKey(true);
                return;
            }
        }
        const all = [...selected];
        // 'clean' satisfies 'add' too, so add is redundant for raw AND clean files
        const isDone = (s: string) => (mode === 'add' ? s !== 'missing' : s === 'clean');
        const pending = all.filter((p) => !isDone(statusOf(p)));
        if (pending.length === all.length) {
            void execute(mode, all, false);
        } else {
            setPendingRun({mode, all, pending});
        }
    };

    return (
        <div className="settings-card">
            <h3>Collections <em>· wiki addition &amp; LLM cleanup</em></h3>
            <div className="desc">
                Add converts PDFs to searchable wiki text (fast, offline, keeps OCR artifacts).
                Clean up runs the Anthropic cleanup pass — fixes reading order and OCR errors and
                captions illustrations (uses the API key below; already-clean files are skipped
                unless you re-run them). The search index rebuilds automatically after each run.
            </div>

            {indexReport != null && indexReport.skipped > 0 && (
                <div style={{fontSize: 12, color: 'var(--danger, #c0392b)', margin: '8px 0'}}>
                    ⚠ {indexReport.skipped} stale search entries from a prior rename — rebuild picks up
                    real collections/ moves automatically, or run scripts/rename_collection.py next time.
                </div>
            )}

            <div style={{display: 'flex', gap: 8, margin: '12px 0'}}>
                <button
                    className="btn primary"
                    disabled={running || selected.size === 0}
                    onClick={() => requestRun('add')}
                >
                    Add to wiki ({selected.size})
                </button>
                <button
                    className="btn"
                    disabled={running || selected.size === 0}
                    onClick={() => requestRun('clean')}
                >
                    Clean up ({selected.size})
                </button>
                {running && (
                    <button className="btn" onClick={() => window.api.collections.cancel()}>
                        Cancel
                    </button>
                )}
            </div>

            {running && (
                <div style={{fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', marginBottom: 8}}>
                    {progress?.kind === 'index'
                        ? 'Rebuilding search index…'
                        : progress?.file
                            ? `${progress.kind === 'proc' ? 'processing' : progress.kind} · ${progress.file}`
                            : 'Starting…'}
                </div>
            )}
            {summary && !running && (
                <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 8}}>{summary}</div>
            )}

            {collections.map((c) => {
                const isOpen = expanded.has(c.name);
                const paths = c.files.map((f) => relPath(c.name, f.name));
                const allChecked = paths.length > 0 && paths.every((p) => selected.has(p));
                return (
                    <div key={c.name} style={{borderTop: '1px solid var(--border)'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0'}}>
                            <input
                                type="checkbox"
                                aria-label={`Select ${c.name}`}
                                checked={allChecked}
                                onChange={() => toggleCollection(c)}
                                disabled={running}
                            />
                            <button
                                type="button"
                                onClick={() => setExpanded((s) => {
                                    const next = new Set(s);
                                    if (next.has(c.name)) next.delete(c.name);
                                    else next.add(c.name);
                                    return next;
                                })}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                    fontWeight: 600,
                                    fontSize: 13,
                                    color: 'var(--ink-1, inherit)',
                                    flex: 1,
                                    textAlign: 'left',
                                }}
                            >
                                <span
                                    aria-hidden="true"
                                    style={{
                                        display: 'inline-block',
                                        transition: 'transform 180ms ease',
                                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    }}
                                >▸ </span>
                                <span>{c.name}</span>
                            </button>
                            <label htmlFor={`citation-type-${c.name}`} style={{fontSize: 11, color: 'var(--ink-3)'}}>
                                Citation type <em>· {c.name}</em>
                            </label>
                            <select
                                id={`citation-type-${c.name}`}
                                value={c.citationType ?? ''}
                                onChange={(e) => setCollectionCitationType(c.name, e.target.value)}
                                style={{fontSize: 11}}
                            >
                                <option value="" disabled>— none set —</option>
                                {SOURCE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            <span style={{fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)'}}>
                {c.total - c.added} of {c.total} to add
              </span>
                            <span style={{fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)'}}>
                {c.total - c.cleaned} of {c.total} to clean
              </span>
                        </div>
                        <div style={{
                            display: 'grid',
                            gridTemplateRows: isOpen ? '1fr' : '0fr',
                            transition: 'grid-template-rows 180ms ease',
                        }}>
                            <div style={{overflow: 'hidden'}}>
                                {c.files.map((f) => {
                                    const p = relPath(c.name, f.name);
                                    return (
                                        <div key={p} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                            padding: '3px 0 3px 26px'
                                        }}>
                                            <input
                                                type="checkbox"
                                                aria-label={f.name}
                                                checked={selected.has(p)}
                                                onChange={() => toggle(p)}
                                                disabled={running}
                                            />
                                            <span
                                                style={{flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)'}}>{f.name}</span>
                                            <span style={{
                                                fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                color: f.status === 'clean' ? 'var(--ok, #2e7d32)' : 'var(--ink-3)',
                                            }}>
                    {liveLabel[p] ?? STATUS_LABEL[f.status]}
                  </span>
                                            <button
                                                type="button"
                                                className="btn"
                                                style={{fontSize: 10, padding: '2px 6px'}}
                                                onClick={() => openHeaderEditor(p)}
                                            >
                                                Edit header
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            })}

            {pendingRun && (
                <RerunDialog
                    run={pendingRun}
                    onRerunAll={() => execute(pendingRun.mode, pendingRun.all, true)}
                    onPendingOnly={() => execute(pendingRun.mode, pendingRun.pending, false)}
                    onCancel={() => setPendingRun(null)}
                />
            )}

            {needsApiKey && <NeedsApiKeyDialog onClose={() => setNeedsApiKey(false)}/>}

            {headerEdit && (
                <HeaderEditorDialog
                    path={headerEdit.path}
                    notAdded={headerEdit.notAdded}
                    onClose={() => setHeaderEdit(null)}
                />
            )}
        </div>
    );
}

function isKnownSourceType(value: string): value is SourceType {
    return (SOURCE_TYPES as string[]).includes(value);
}

function propertyLabel(key: string): string {
    return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

function HeaderEditorDialog({path, notAdded, onClose}: {
    path: string;
    notAdded: boolean;
    onClose: () => void;
}) {
    const [loading, setLoading] = useState(!notAdded);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [citationType, setCitationType] = useState('');
    const [fields, setFields] = useState<Record<string, string>>({});
    const [preserved, setPreserved] = useState<WikiHeaderPreserved | null>(null);
    const [saveErrors, setSaveErrors] = useState<string[] | null>(null);

    useEffect(() => {
        if (notAdded) return;
        window.api.wiki.getHeader(path).then((payload) => {
            if (payload) {
                setCitationType(payload.citationType);
                setFields(payload.fields);
                setPreserved(payload.preserved);
                setLoaded(true);
            }
            setLoading(false);
        });
    }, [path, notAdded]);

    const knownType = isKnownSourceType(citationType);
    const schemaRow = knownType ? HEADER_SCHEMA[citationType] : null;
    const validation = knownType ? validateHeader(citationType, fields) : null;
    const canSave = !!validation && validation.ok;

    const setField = (key: string, value: string) =>
        setFields((f) => ({...f, [key]: value}));

    const save = async () => {
        setSaving(true);
        setSaveErrors(null);
        // Drop values left over from a previously selected citation type before sending —
        // the schema, not the save-time payload, is the source of truth for what applies now.
        const toSend: Record<string, string> = {};
        if (schemaRow) {
            for (const prop of HEADER_PROPERTIES) {
                if (schemaRow[prop] !== 'n/a') toSend[prop] = fields[prop] ?? '';
            }
        }
        const result = await window.api.wiki.saveHeader(path, {citationType, fields: toSend});
        setSaving(false);
        if (result.ok) {
            onClose();
            return;
        }
        setSaveErrors('errors' in result ? result.errors : [result.error]);
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            }}
        >
            <div style={{
                background: 'var(--bg-1, #fff)', borderRadius: 8, padding: 20, width: 560, maxWidth: '90vw',
                maxHeight: '85vh', overflowY: 'auto',
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            }}>
                <div style={{fontWeight: 600, marginBottom: 8}}>
                    OKF header <em>· {path.split('/').pop()}</em>
                </div>

                {notAdded ? (
                    <>
                        <div style={{fontSize: 13, marginBottom: 14}}>
                            This file needs to be added to the wiki first — run &quot;Add to wiki&quot; above,
                            then come back to edit its OKF header.
                        </div>
                        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                            <button className="btn primary" onClick={onClose}>OK</button>
                        </div>
                    </>
                ) : loading ? (
                    <div style={{fontSize: 13, color: 'var(--ink-3)'}}>Loading…</div>
                ) : !loaded ? (
                    <div style={{fontSize: 13, color: 'var(--ink-3)'}}>Could not load this file&rsquo;s header.</div>
                ) : (
                    <>
                        <div style={{marginBottom: 12}}>
                            <label htmlFor="header-citation-type" className="label">Citation type</label>
                            <select
                                id="header-citation-type"
                                className="input"
                                value={citationType}
                                onChange={(e) => setCitationType(e.target.value)}
                                style={{display: 'block', width: '100%', marginTop: 4}}
                            >
                                {!knownType && citationType && (
                                    <option value={citationType} disabled>{citationType} (unrecognized)</option>
                                )}
                                {SOURCE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                            {!knownType && (
                                <div role="alert" style={{fontSize: 12, color: 'var(--danger, #c0392b)', marginTop: 4}}>
                                    Unrecognized citation type — choose one above to continue.
                                </div>
                            )}
                        </div>

                        {schemaRow && HEADER_PROPERTIES.filter((prop) => schemaRow[prop] !== 'n/a').map((prop) => {
                            const control = HEADER_PROPERTY_CONTROL[prop];
                            const id = `header-${prop}`;
                            return (
                                <div key={prop} style={{marginBottom: 12}}>
                                    <label htmlFor={id} className="label">
                                        {propertyLabel(prop)}
                                        {schemaRow[prop] === 'required' && <span aria-hidden="true"> *</span>}
                                    </label>
                                    {control === 'multiline' ? (
                                        <textarea
                                            id={id}
                                            className="input"
                                            value={fields[prop] ?? ''}
                                            onChange={(e) => setField(prop, e.target.value)}
                                            style={{display: 'block', width: '100%', marginTop: 4, minHeight: 60, boxSizing: 'border-box'}}
                                        />
                                    ) : (
                                        <input
                                            id={id}
                                            className="input"
                                            type="text"
                                            value={fields[prop] ?? ''}
                                            onChange={(e) => setField(prop, e.target.value)}
                                            style={{display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box'}}
                                        />
                                    )}
                                </div>
                            );
                        })}

                        {preserved && (
                            <div style={{fontSize: 12, color: 'var(--ink-3)', marginTop: 4, marginBottom: 8}}>
                                <div>Type: {preserved.type || '—'}</div>
                                <div>Resource: {preserved.resource}</div>
                                <div>Timestamp: {preserved.timestamp}</div>
                                <div>Pages: {preserved.pages}</div>
                            </div>
                        )}

                        {validation && !validation.ok && (
                            <div role="alert" style={{marginTop: 8, fontSize: 12, color: 'var(--danger, #c0392b)'}}>
                                {validation.errors.join(' ')}
                            </div>
                        )}
                        {saveErrors && (
                            <div style={{marginTop: 8, fontSize: 12, color: 'var(--danger, #c0392b)'}}>
                                {saveErrors.join(' ')}
                            </div>
                        )}

                        <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12}}>
                            <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
                            <button className="btn primary" onClick={save} disabled={saving || !canSave}>Save</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function NeedsApiKeyDialog({onClose}: { onClose: () => void }) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            }}
        >
            <div style={{
                background: 'var(--bg-1, #fff)', borderRadius: 8, padding: 20, maxWidth: 440,
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            }}>
                <div style={{fontWeight: 600, marginBottom: 8}}>
                    <p>This function uses Anthropic&rsquo;s Claude to scan and clean documents. </p>
                    <p>An Anthropic API key is required. </p>
                    <p> Add it below</p>
                </div>
                <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                    Enter API key below.
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                    <button className="btn primary" onClick={onClose}>OK</button>
                </div>
            </div>
        </div>
    );
}

function RerunDialog({run, onRerunAll, onPendingOnly, onCancel}: {
    run: PendingRun;
    onRerunAll: () => void;
    onPendingOnly: () => void;
    onCancel: () => void;
}) {
    const done = run.all.length - run.pending.length;
    const verb = run.mode === 'add' ? 'added' : 'cleaned';
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
            <div style={{
                background: 'var(--bg-1, #fff)', borderRadius: 8, padding: 20, maxWidth: 440,
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            }}>
                <div style={{fontWeight: 600, marginBottom: 8}}>
                    {done} of {run.all.length} selected files are already {verb}.
                </div>
                <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                    Re-running redoes them from the source PDFs
                    {run.mode === 'clean' ? ' (this spends API credits again)' : ''}.
                </div>
                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                    <button className="btn" onClick={onCancel}>Cancel</button>
                    {run.pending.length > 0 && (
                        <button className="btn" onClick={onPendingOnly}>
                            Only the {run.pending.length} pending
                        </button>
                    )}
                    <button className="btn primary" onClick={onRerunAll}>
                        Re-run all {run.all.length}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ApiKeyCard() {
    const [saved, setSaved] = useState('');
    const [draft, setDraft] = useState('');
    const [reveal, setReveal] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.api.ai.getApiKey().then((key) => {
            setSaved(key);
            setDraft(key);
        });
    }, []);

    const flash = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 1600);
    };

    const save = async () => {
        const key = draft.trim();
        if (key && !key.startsWith('sk-ant-')) {
            setError('That does not look like an Anthropic key — it should start with sk-ant-.');
            return;
        }
        setError(null);
        await window.api.ai.setApiKey(key);
        setSaved(key);
        setDraft(key);
        flash(key ? 'API key saved' : 'API key removed');
    };

    const remove = async () => {
        setError(null);
        await window.api.ai.setApiKey('');
        setSaved('');
        setDraft('');
        flash('API key removed');
    };

    return (
        <div className="settings-card">
            <h3>Anthropic API key <em>· OCR cleanup &amp; photo captions</em></h3>
            <div className="desc">
                Used by the clean-up runs above. Stored locally in{' '}
                <code style={{fontFamily: 'var(--font-mono)'}}>.anthropic_api_key</code> at the
                repository root — gitignored, owner-readable only, and never leaves this machine
                except in requests to the Anthropic API. An{' '}
                <code style={{fontFamily: 'var(--font-mono)'}}>ANTHROPIC_API_KEY</code> environment
                variable, when set, takes precedence.
            </div>

            <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 12}}>
                <label htmlFor="anthropic-api-key" className="label" style={{minWidth: 130}}>
                    Anthropic API key
                </label>
                <input
                    id="anthropic-api-key"
                    className="input"
                    style={{flex: 1, fontFamily: 'var(--font-mono)'}}
                    type={reveal ? 'text' : 'password'}
                    placeholder="sk-ant-…"
                    value={draft}
                    onChange={(e) => {
                        setError(null);
                        setDraft(e.target.value);
                    }}
                    autoComplete="off"
                    spellCheck={false}
                />
                <button className="btn" type="button" onClick={() => setReveal((r) => !r)}>
                    {reveal ? 'Hide' : 'Show'}
                </button>
            </div>

            {error && (
                <div style={{marginTop: 8, fontSize: 12, color: 'var(--danger, #c0392b)'}}>{error}</div>
            )}

            <div style={{display: 'flex', gap: 8, marginTop: 14}}>
                <button
                    className="btn primary"
                    type="button"
                    onClick={save}
                    disabled={draft.trim() === saved}
                >
                    Save
                </button>
                {saved && (
                    <button className="btn" type="button" onClick={remove}>
                        Remove key
                    </button>
                )}
                {toast && (
                    <span style={{alignSelf: 'center', fontSize: 12, color: 'var(--ink-3)'}}>{toast}</span>
                )}
            </div>
        </div>
    );
}
