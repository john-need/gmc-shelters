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
    COLLECTION_DEFAULT_PROPERTIES,
    HEADER_PROPERTIES,
    HEADER_PROPERTY_CONTROL,
    HEADER_SCHEMA,
    LANGUAGE_OPTIONS,
    SOURCE_TYPES,
    validateHeader,
} from '../../../shared/wiki-header-schema';

const EDIT_ICON = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
);

const TRASH_ICON = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
);

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

export default function CollectionsManagementPage({onOpenAiSettings}: {onOpenAiSettings?: () => void}) {
    return (
        <>
            <div className="settings-page-head">
                <div>
                    <div
                        className="settings-page-title"
                        dangerouslySetInnerHTML={{__html: 'Collections <em>· Primary Source Management</em>'}}
                    />
                    <div className="settings-page-sub">§ Settings / Collections</div>
                </div>
            </div>

            <div className="settings-body">
                <CollectionsCard onOpenAiSettings={onOpenAiSettings}/>
                <ApiKeyNote onOpenAiSettings={onOpenAiSettings}/>
            </div>
        </>
    );
}

function ApiKeyNote({onOpenAiSettings}: {onOpenAiSettings?: () => void}) {
    return (
        <div className="settings-card">
            <h3>Anthropic API key <em>· OCR cleanup &amp; photo captions</em></h3>
            <div className="desc">
                Clean-up runs above use Anthropic&rsquo;s Claude and require an API key. Manage
                the key and which model is used on the{' '}
                <button type="button" className="btn ghost sm" onClick={onOpenAiSettings}>
                    AI Settings
                </button>{' '}
                page.
            </div>
        </div>
    );
}

function CollectionsCard({onOpenAiSettings}: {onOpenAiSettings?: () => void}) {
    const [collections, setCollections] = useState<CollectionStatus[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [collectionEdit, setCollectionEdit] = useState<string | null>(null);
    const [addingCollection, setAddingCollection] = useState(false);
    const [deleteFile, setDeleteFile] = useState<{ collection: string; file: string } | null>(null);
    const [deleteCollectionName, setDeleteCollectionName] = useState<string | null>(null);
    const [dropNote, setDropNote] = useState<Record<string, string>>({});
    const runRef = useRef<{ mode: CollectionsRunMode; files: string[] }>({mode: 'add', files: []});

    const refresh = useCallback(() => {
        window.api.collections.status().then((data) => {
            setCollections(data);
            setLoading(false);
        });
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

    const dropFiles = async (collectionName: string, fileList: FileList | File[]) => {
        const incoming = [...fileList];
        const pdfs = incoming.filter((f) => /\.pdf$/i.test(f.name));
        const nonPdfCount = incoming.length - pdfs.length;
        const sourcePaths = pdfs.map((f) => window.api.app.getFilePath(f)).filter(Boolean);

        const result = sourcePaths.length
            ? await window.api.collections.addFiles({collection: collectionName, sourcePaths})
            : {added: [], skipped: []};

        const notes: string[] = [];
        if (result.added.length) notes.push(`${result.added.length} file${result.added.length === 1 ? '' : 's'} added`);
        if (result.skipped.length) notes.push(`${result.skipped.length} skipped — already in this collection`);
        if (nonPdfCount) notes.push(`${nonPdfCount} skipped — only PDFs are accepted`);
        if (notes.length) {
            setDropNote((n) => ({...n, [collectionName]: notes.join('; ') + '.'}));
            setTimeout(() => setDropNote((n) => {
                const next = {...n};
                delete next[collectionName];
                return next;
            }), 2600);
        }
        if (result.added.length) refresh();
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
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8}}>
                <h3 style={{margin: 0}}>Collections <em>· wiki addition &amp; LLM cleanup</em></h3>
                <button type="button" className="btn sm" onClick={() => setAddingCollection(true)}>
                    + Add collection
                </button>
            </div>
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

            {loading ? (
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{animation: 'spin 1s linear infinite'}}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    <div style={{fontSize: 12, color: 'var(--ink-3)'}}>Loading collections…</div>
                </div>
            ) : (
            <>
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
                                <svg
                                    width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                    aria-hidden="true"
                                    style={{
                                        display: 'inline-block', flexShrink: 0, marginRight: 4,
                                        transition: 'transform 180ms ease',
                                        transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    }}
                                >
                                    <path d="m9 6 6 6-6 6"/>
                                </svg>
                                <span>{c.name}</span>
                            </button>
                            <span style={{fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)'}}>
                {c.total - c.added} of {c.total} to add
              </span>
                            <span style={{fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-mono)'}}>
                {c.total - c.cleaned} of {c.total} to clean
              </span>
                            <button
                                type="button"
                                className="btn icon sm"
                                title="Edit collection defaults"
                                onClick={() => setCollectionEdit(c.name)}
                            >
                                {EDIT_ICON}
                            </button>
                            <button
                                type="button"
                                className="btn icon sm"
                                title="Delete collection"
                                onClick={() => setDeleteCollectionName(c.name)}
                            >
                                {TRASH_ICON}
                            </button>
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
                                                className="btn icon sm"
                                                title="Open PDF"
                                                onClick={async () => {
                                                    const {ok} = await window.api.wiki.openPdf(p, 1);
                                                    if (!ok) setSummary(`PDF not found — ${p} is missing on disk.`);
                                                }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                                                </svg>
                                            </button>
                                            <button
                                                type="button"
                                                className="btn icon sm"
                                                title="Edit header"
                                                onClick={() => openHeaderEditor(p)}
                                            >
                                                {EDIT_ICON}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn icon sm"
                                                title="Delete file"
                                                onClick={() => setDeleteFile({collection: c.name, file: f.name})}
                                            >
                                                {TRASH_ICON}
                                            </button>
                                        </div>
                                    );
                                })}
                                <CollectionDropZone
                                    onDrop={(files) => dropFiles(c.name, files)}
                                />
                                {dropNote[c.name] && (
                                    <div style={{fontSize: 11, color: 'var(--ink-3)', margin: '-4px 0 8px 26px'}}>
                                        {dropNote[c.name]}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
            </>
            )}

            {pendingRun && (
                <RerunDialog
                    run={pendingRun}
                    onRerunAll={() => execute(pendingRun.mode, pendingRun.all, true)}
                    onPendingOnly={() => execute(pendingRun.mode, pendingRun.pending, false)}
                    onCancel={() => setPendingRun(null)}
                />
            )}

            {needsApiKey && (
                <NeedsApiKeyDialog
                    onClose={() => setNeedsApiKey(false)}
                    onOpenAiSettings={() => {
                        setNeedsApiKey(false);
                        onOpenAiSettings?.();
                    }}
                />
            )}

            {headerEdit && (
                <HeaderEditorDialog
                    path={headerEdit.path}
                    notAdded={headerEdit.notAdded}
                    onClose={() => setHeaderEdit(null)}
                />
            )}

            {collectionEdit && (() => {
                const c = collections.find((x) => x.name === collectionEdit);
                if (!c) return null;
                return (
                    <CollectionDefaultsDialog
                        name={c.name}
                        citationType={c.citationType ?? ''}
                        defaults={c.defaults}
                        onClose={() => setCollectionEdit(null)}
                        onSaved={() => {
                            setCollectionEdit(null);
                            refresh();
                        }}
                    />
                );
            })()}

            {deleteFile && (
                <FileDeleteModal
                    fileName={deleteFile.file}
                    onCancel={() => setDeleteFile(null)}
                    onConfirm={async () => {
                        await window.api.collections.deleteFile(deleteFile);
                        setDeleteFile(null);
                        refresh();
                    }}
                />
            )}

            {deleteCollectionName && (() => {
                const c = collections.find((x) => x.name === deleteCollectionName);
                if (!c) return null;
                return (
                    <CollectionDeleteModal
                        name={c.name}
                        fileCount={c.total}
                        onCancel={() => setDeleteCollectionName(null)}
                        onConfirm={async () => {
                            await window.api.collections.delete({name: c.name});
                            setDeleteCollectionName(null);
                            refresh();
                        }}
                    />
                );
            })()}

            {addingCollection && (
                <CollectionDefaultsDialog
                    creating
                    existingNames={collections.map((c) => c.name)}
                    citationType=""
                    defaults={{}}
                    onClose={() => setAddingCollection(false)}
                    onSaved={() => {
                        setAddingCollection(false);
                        refresh();
                    }}
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
                                    ) : control === 'select' && prop === 'language' ? (
                                        <select
                                            id={id}
                                            className="input"
                                            value={fields[prop] ?? ''}
                                            onChange={(e) => setField(prop, e.target.value)}
                                            style={{display: 'block', width: '100%', marginTop: 4}}
                                        >
                                            {LANGUAGE_OPTIONS.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <>
                                            <input
                                                id={id}
                                                className="input"
                                                type="text"
                                                value={fields[prop] ?? ''}
                                                onChange={(e) => setField(prop, e.target.value)}
                                                placeholder={control === 'flexible-date' ? 'YYYY-MM-DD, YYYY-MM, YYYY, or "Spring 1996"' : undefined}
                                                style={{display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box'}}
                                            />
                                            {control === 'flexible-date' && (
                                                <div style={{fontSize: 11, color: 'var(--ink-3)', marginTop: 2}}>
                                                    Full date, month, year, or season (e.g. &quot;Spring 1996&quot;).
                                                </div>
                                            )}
                                        </>
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

function validateCollectionName(name: string, existingNames: string[]): string | null {
    const trimmed = name.trim();
    if (!trimmed) return 'Folder name is required.';
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(trimmed)) {
        return 'Use lowercase letters, digits, and hyphens only (e.g. camels-hump-survey-notes).';
    }
    if (existingNames.includes(trimmed)) return `A collection named "${trimmed}" already exists.`;
    return null;
}

function CollectionDefaultsDialog({name, citationType, defaults, existingNames = [], creating, onClose, onSaved}: {
    name?: string;
    citationType: string;
    defaults: Record<string, string>;
    existingNames?: string[];
    creating?: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [nextName, setNextName] = useState(name ?? '');
    const [nextCitationType, setNextCitationType] = useState(citationType);
    const [fields, setFields] = useState<Record<string, string>>(defaults);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const knownType = isKnownSourceType(nextCitationType);
    const schemaRow = knownType ? HEADER_SCHEMA[nextCitationType] : null;
    const nameError = creating ? validateCollectionName(nextName, existingNames) : null;
    const canSave = !!nextCitationType && !(creating && nameError);

    const setField = (key: string, value: string) =>
        setFields((f) => ({...f, [key]: value}));

    const save = async () => {
        if (!canSave) return;
        setSaving(true);
        setError(null);
        const toSend: Record<string, string> = {};
        for (const prop of COLLECTION_DEFAULT_PROPERTIES) {
            toSend[prop] = schemaRow && schemaRow[prop] !== 'n/a' ? (fields[prop] ?? '') : '';
        }
        const result = await window.api.collections.setDefaults({
            name: creating ? nextName.trim() : (name as string),
            oldCitationType: creating ? '' : citationType,
            citationType: nextCitationType,
            oldDefaults: defaults,
            defaults: toSend,
        });
        setSaving(false);
        if (result.ok) {
            onSaved();
            return;
        }
        setError(result.error ?? 'Save failed.');
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
                    {creating ? 'New collection' : <>Collection defaults <em>· {name}</em></>}
                </div>

                {creating ? (
                    <div style={{marginBottom: 12}}>
                        <label htmlFor="new-collection-name" className="label">Folder name</label>
                        <input
                            id="new-collection-name"
                            className="input"
                            type="text"
                            autoFocus
                            value={nextName}
                            onChange={(e) => setNextName(e.target.value)}
                            placeholder="e.g. camels-hump-survey-notes"
                            style={{display: 'block', width: '100%', marginTop: 4, fontFamily: 'var(--font-mono)'}}
                        />
                        {nameError && nextName && (
                            <div role="alert" style={{fontSize: 12, color: 'var(--danger, #c0392b)', marginTop: 4}}>
                                {nameError}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                        Saving updates every document in this collection whose field is currently blank or still
                        matches the old default — customized documents are left alone.
                    </div>
                )}

                <div style={{marginBottom: 12}}>
                    <label htmlFor="collection-citation-type" className="label">Citation type</label>
                    <select
                        id="collection-citation-type"
                        className="input"
                        value={nextCitationType}
                        onChange={(e) => setNextCitationType(e.target.value)}
                        style={{display: 'block', width: '100%', marginTop: 4}}
                    >
                        <option value="" disabled>— none set —</option>
                        {SOURCE_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>

                {schemaRow && COLLECTION_DEFAULT_PROPERTIES.filter((prop) => schemaRow[prop] !== 'n/a').map((prop) => {
                    const control = HEADER_PROPERTY_CONTROL[prop];
                    const id = `collection-default-${prop}`;
                    return (
                        <div key={prop} style={{marginBottom: 12}}>
                            <label htmlFor={id} className="label">{propertyLabel(prop)}</label>
                            {control === 'multiline' ? (
                                <textarea
                                    id={id}
                                    className="input"
                                    value={fields[prop] ?? ''}
                                    onChange={(e) => setField(prop, e.target.value)}
                                    style={{display: 'block', width: '100%', marginTop: 4, minHeight: 60, boxSizing: 'border-box'}}
                                />
                            ) : control === 'select' && prop === 'language' ? (
                                <select
                                    id={id}
                                    className="input"
                                    value={fields[prop] ?? ''}
                                    onChange={(e) => setField(prop, e.target.value)}
                                    style={{display: 'block', width: '100%', marginTop: 4}}
                                >
                                    {LANGUAGE_OPTIONS.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
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

                {error && (
                    <div style={{marginTop: 8, fontSize: 12, color: 'var(--danger, #c0392b)'}}>{error}</div>
                )}

                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12}}>
                    <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
                    <button className="btn primary" onClick={save} disabled={saving || !canSave}>
                        {creating ? 'Create' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function CollectionDropZone({onDrop}: { onDrop: (files: FileList) => void }) {
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            className={`upload-zone ${dragOver ? 'drag' : ''}`}
            style={{margin: '4px 0 8px 26px', padding: 12}}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length) onDrop(e.dataTransfer.files);
            }}
        >
            <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                multiple
                style={{display: 'none'}}
                onChange={(e) => {
                    if (e.target.files?.length) onDrop(e.target.files);
                    e.target.value = '';
                }}
            />
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
                </svg>
                <span className="upload-sub">Drag PDFs here, or click to browse</span>
            </div>
        </div>
    );
}

function FileDeleteModal({fileName, onCancel, onConfirm}: {
    fileName: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
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
                <div style={{fontWeight: 600, marginBottom: 8}}>Delete &quot;{fileName}&quot;?</div>
                <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                    This removes the file from the collection and can&rsquo;t be undone.
                </div>
                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                    <button className="btn" onClick={onCancel}>Cancel</button>
                    <button className="btn rust" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

function CollectionDeleteModal({name, fileCount, onCancel, onConfirm}: {
    name: string;
    fileCount: number;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const hasFiles = fileCount > 0;
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
                <div style={{fontWeight: 600, marginBottom: 8}}>Delete &quot;{name}&quot;?</div>
                {hasFiles ? (
                    <div style={{fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 14}}>
                        This collection has <strong>{fileCount} file{fileCount === 1 ? '' : 's'}</strong>.
                        Deleting it removes all of them — and any wiki entries already built from them —
                        and can&rsquo;t be undone.
                    </div>
                ) : (
                    <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                        This collection is empty — safe to remove.
                    </div>
                )}
                <div style={{display: 'flex', gap: 8, justifyContent: 'flex-end'}}>
                    <button className="btn" onClick={onCancel}>Cancel</button>
                    <button className="btn rust" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

function NeedsApiKeyDialog({onClose, onOpenAiSettings}: { onClose: () => void; onOpenAiSettings?: () => void }) {
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
                    <p>An Anthropic API key is required.</p>
                </div>
                <div style={{fontSize: 12, color: 'var(--ink-3)', marginBottom: 14}}>
                    Add one on the AI Settings page.
                </div>
                <div style={{display: 'flex', justifyContent: 'flex-end', gap: 8}}>
                    <button className="btn" onClick={onClose}>Cancel</button>
                    <button className="btn primary" onClick={onOpenAiSettings}>Go to AI Settings</button>
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
