import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { setHistoryContent, saveHistory, setShelterHistoryThunk, loadHistory } from '../../../store/sheltersSlice';
import { createSource, deleteSource } from '../../../store/sourcesSlice';
import { showToast } from '../../../store/uiSlice';
import { loadApiKey, selectHasValidApiKey } from '../../../store/aiSettingsSlice';
import { buildHistoryFileDisplayPath, loadStoredPaths } from '../../../pathSettings';
import { loadHistoryViewMode, saveHistoryViewMode, type HistoryViewMode } from '../../../historyViewSettings';
import { stripSourcesSection, assembleAcceptedHistory } from '../../../../shared/generate-history';
import { parseHistorySourcesSection } from '../../../../shared/history-sources';
import type { CollectionStatus, GenerateHistoryError, GenerateHistoryEvent, GenerateHistoryRequest, SourceInput } from '../../../../shared/ipc-types';
import { renderMarkdown } from '../../../markdown';
import { BLANK_SOURCE } from './sourceTypes';
import GenerateHistoryModal from './GenerateHistoryModal';

type PendingPermission = { requestId: string; tool: 'search_collections' | 'download_document'; input: unknown };

export default function HistoryTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const value = useSelector((state: RootState) => state.shelters.historyContent);
  const dirty = useSelector((state: RootState) => state.shelters.historyDirty);
  const missing = useSelector((state: RootState) => state.shelters.historyMissing);
  const selectedId = useSelector((state: RootState) => state.shelters.selectedId);
  const sourcesForShelter = useSelector((state: RootState) => (s ? state.sources.byShelter[s.id] : undefined)) ?? [];
  const hasValidApiKey = useSelector(selectHasValidApiKey);
  const ref = useRef<HTMLTextAreaElement>(null);
  const [browsingPath, setBrowsingPath] = useState(false);
  const [viewMode, setViewMode] = useState<HistoryViewMode>(loadHistoryViewMode);
  const [generating, setGenerating] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [draftNarrative, setDraftNarrative] = useState<string | null>(null);
  const [generateEvents, setGenerateEvents] = useState<GenerateHistoryEvent[]>([]);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [collections, setCollections] = useState<CollectionStatus[]>([]);
  const cancelledRef = useRef(false);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    dispatch(loadApiKey());
  }, [dispatch]);

  useEffect(() => {
    window.api.collections.status().then(setCollections).catch(() => {});
  }, []);

  const changeViewMode = (mode: HistoryViewMode) => {
    setViewMode(mode);
    saveHistoryViewMode(mode);
  };

  const generateErrorMessage = (error: GenerateHistoryError): string => {
    if (error === 'no_api_key') return 'No Anthropic API key configured — add one in Settings → AI Settings.';
    if (error === 'max_turns') return 'Generate History took too many steps and gave up — try again.';
    return 'Generate History failed — try again.';
  };

  const handleGenerateHistory = async () => {
    if (!s || generating) return;
    const targetShelterId = s.id;
    cancelledRef.current = false;
    setGenerating(true);
    setGenerateError(null);
    setDraftNarrative(null);
    setGenerateEvents([]);
    setPendingPermission(null);
    setModalOpen(true);

    const unsubscribe = window.api.history.onGenerateProgress((evt) => {
      if (selectedIdRef.current !== targetShelterId || cancelledRef.current) return;
      setGenerateEvents((prev) => [...prev, evt]);
      if (evt.type === 'permission_request') {
        setPendingPermission({ requestId: evt.requestId, tool: evt.tool, input: evt.input });
      }
    });

    const request: GenerateHistoryRequest = {
      shelter: {
        name: s.name,
        architecture: s.architecture,
        built_by: s.built_by,
        description: s.description,
        notes: s.notes,
        start_year: s.start_year,
        end_year: s.end_year,
        is_extant: s.is_extant,
        is_gmc: s.is_gmc,
        category: s.category,
      },
      citations: sourcesForShelter.filter((src) => src.include_in_history),
      currentHistory: stripSourcesSection(value),
    };
    try {
      const result = await window.api.history.generate(request);
      if (selectedIdRef.current === targetShelterId && !cancelledRef.current) {
        if (result.ok) {
          setDraftNarrative(result.narrative);
        } else {
          setGenerateError(generateErrorMessage(result.error));
        }
      }
    } finally {
      unsubscribe();
      setGenerating(false);
      setPendingPermission(null);
    }
  };

  const handleRespondPermission = (requestId: string, approved: boolean) => {
    setPendingPermission(null);
    void window.api.history.respondToPermission(requestId, approved);
  };

  const closeGenerateModal = () => {
    if (generating) {
      cancelledRef.current = true;
      if (pendingPermission) void window.api.history.respondToPermission(pendingPermission.requestId, false);
    }
    setModalOpen(false);
    setDraftNarrative(null);
    setGenerateError(null);
    setPendingPermission(null);
  };

  if (!s) return null;

  const historyRelPath = s.history ?? `${s.slug}/${s.slug}.md`;
  const parsedHistorySources = parseHistorySourcesSection(value, collections);
  const wordCount = (value.match(/\S+/g) || []).length;
  const charCount = value.length;
  const lineCount = value.split('\n').length;
  const fileName = historyRelPath.split('/').pop() ?? `${s.slug}.md`;
  const filePath = buildHistoryFileDisplayPath(loadStoredPaths().SHELTERS_ROOT, historyRelPath);

  const onChange = (next: string) => dispatch(setHistoryContent(next));

  const wrap = (before: string, after = '') => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = value.slice(start, end);
    onChange(value.slice(0, start) + before + sel + after + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, end + before.length);
    });
  };

  const prefix = (p: string) => {
    const ta = ref.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    onChange(value.slice(0, lineStart) + p + value.slice(lineStart));
  };

  const handleSave = async () => {
    const result = await dispatch(saveHistory({ historyRelPath, content: value }));
    if (saveHistory.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: `Saved · ${filePath}` }));
    }
  };

  const handleCreate = async () => {
    const initial = `# ${s.name}\n`;
    dispatch(setHistoryContent(initial));
    const result = await dispatch(saveHistory({ historyRelPath, content: initial }));
    if (saveHistory.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: `Created · ${filePath}` }));
    }
  };

  const handleReplaceSources = async () => {
    if (!parsedHistorySources.length) return;
    const ok = confirm(
      `Replace ${sourcesForShelter.length} current source${sourcesForShelter.length === 1 ? '' : 's'} `
      + `with ${parsedHistorySources.length} parsed from the history file? This cannot be undone.`,
    );
    if (!ok) return;

    for (const src of sourcesForShelter) {
      try {
        await dispatch(deleteSource({ id: src.id, shelterId: s.id })).unwrap();
      } catch {
        // best-effort, matches the other bulk flows: one failure shouldn't block the rest
      }
    }
    let linked = 0;
    for (const src of parsedHistorySources) {
      // Best-effort link to the primary-source document in collections — makes the
      // Sources tab's View PDF button work for the recreated citation.
      let resource: string | null = null;
      const citedName = src.container_title || src.title || '';
      if (citedName) {
        try {
          resource = await window.api.wiki.findResource({
            title: citedName,
            date: src.date || undefined,
            year: src.year ?? undefined,
            edition: src.edition || undefined,
            volume: src.volume || undefined,
          });
        } catch {
          // linking is optional — a lookup failure shouldn't block the source itself
        }
      }
      if (resource) linked += 1;

      try {
        await dispatch(createSource({
          ...BLANK_SOURCE, ...src, archive_location: resource ?? '', include_in_history: true, shelter_id: s.id,
        } as SourceInput)).unwrap();
      } catch {
        // best-effort
      }
    }
    dispatch(showToast({
      id: 'replace-sources',
      message: `Sources replaced — ${parsedHistorySources.length} added, ${linked} linked`,
    }));
  };

  const handleBrowsePath = async () => {
    if (browsingPath) return;
    setBrowsingPath(true);
    try {
      const selected = await window.api.app.browseForHistoryFile(loadStoredPaths().SHELTERS_ROOT);
      if (!selected || selected === historyRelPath) return;
      const result = await dispatch(setShelterHistoryThunk({ id: s.id, history: selected }));
      if (setShelterHistoryThunk.fulfilled.match(result)) {
        dispatch(loadHistory(selected));
        dispatch(showToast({ id: Date.now().toString(), message: `History file updated` }));
      }
    } finally {
      setBrowsingPath(false);
    }
  };

  if (missing) {
    return (
      <div className="md-editor" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
        <span>History file not found: <code>{historyRelPath}</code></span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn sm primary" onClick={handleCreate}>Create File</button>
          <button className="btn sm" onClick={handleBrowsePath} disabled={browsingPath}>
            {browsingPath ? 'Opening…' : 'Browse…'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="md-editor">
      <div className="md-toolbar">
        <button className="md-tool" title="Heading 1" onClick={() => prefix('# ')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h12M4 5v14M16 5v14M19 8v11M19 8l-2 1"/>
          </svg>
        </button>
        <button className="md-tool" title="Heading 2" onClick={() => prefix('## ')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12h12M4 5v14M16 5v14M19 19c0-2 3-2 3-4 0-1.5-1-2-2-2-1 0-2 .5-2 2"/>
          </svg>
        </button>
        <div className="md-tool-divider" />
        <button className="md-tool" title="Bold" onClick={() => wrap('**', '**')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z"/>
          </svg>
        </button>
        <button className="md-tool" title="Italic" onClick={() => wrap('*', '*')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 4h-9M14 20H5M15 4 9 20"/>
          </svg>
        </button>
        <div className="md-tool-divider" />
        <button className="md-tool" title="Bulleted list" onClick={() => prefix('- ')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </button>
        <button className="md-tool" title="Numbered list" onClick={() => prefix('1. ')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 6h11M10 12h11M10 18h11M4 4h1v4M4 16h2v.5a1.5 1.5 0 0 1-1.5 1.5H4"/>
          </svg>
        </button>
        <button className="md-tool" title="Blockquote" onClick={() => prefix('> ')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21c3 0 7-1 7-8V5h-7v9h3M14 21c3 0 7-1 7-8V5h-7v9h3"/>
          </svg>
        </button>
        <div className="md-tool-divider" />
        <button className="md-tool" title="Link" onClick={() => wrap('[', '](url)')}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>
          </svg>
        </button>

        <div className="md-tool-divider" />
        <div className="md-view-toggle" role="group" aria-label="History view mode">
          {(['source', 'both', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`md-view-btn${viewMode === mode ? ' active' : ''}`}
              aria-pressed={viewMode === mode}
              onClick={() => changeViewMode(mode)}
            >
              {mode === 'source' ? 'Source' : mode === 'both' ? 'Both' : 'Preview'}
            </button>
          ))}
        </div>

        <button
          className="btn sm"
          title={hasValidApiKey ? 'Generate History' : 'Generate History (requires AI API key)'}
          disabled={!hasValidApiKey || generating}
          onClick={handleGenerateHistory}
        >
          {generating ? 'Generating…' : 'Generate History'}
        </button>

        <button
          className="btn sm"
          title="Replace Sources"
          disabled={!parsedHistorySources.length}
          onClick={handleReplaceSources}
        >
          Replace Sources
        </button>

        <span className="md-tool-label">
          {dirty ? (
            <>
              <span style={{ color: 'var(--rust)', fontWeight: 600 }}>● Modified</span>
              {` · ${fileName}`}
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 4 }}>
                <path d="M5 12.5 10 17 19 7.5"/>
              </svg>
              {`Saved · ${fileName}`}
            </>
          )}
        </span>
      </div>

      <div className={`md-split mode-${viewMode}`}>
        <div className="md-pane md-pane--source" aria-hidden={viewMode === 'preview'}>
          <div className="md-pane-head">
            <span>Source</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="filename">{filePath}</span>
              <button
                className="btn sm"
                style={{ fontSize: 10, padding: '1px 5px', opacity: 0.7 }}
                onClick={handleBrowsePath}
                disabled={browsingPath}
                title="Choose a different history file"
              >
                {browsingPath ? '…' : 'Browse…'}
              </button>
              {dirty && <span className="dirty"> ·</span>}
            </span>
          </div>
          <textarea
            ref={ref}
            className="md-source"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="md-pane md-pane--preview" aria-hidden={viewMode === 'source'}>
          <div className="md-pane-head">
            <span>Preview</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              live
            </span>
          </div>
          <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
        </div>
      </div>

      <div className="md-statusbar">
        <span>LN {lineCount}</span>
        <span>·</span>
        <span>{wordCount.toLocaleString()} words</span>
        <span>·</span>
        <span>{charCount.toLocaleString()} chars</span>
        <span style={{ marginLeft: 'auto' }}>UTF-8 · LF · markdown</span>
        <span>·</span>
        <button className="btn primary" onClick={handleSave} disabled={!dirty}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
          </svg>
          {' '}Save file
        </button>
      </div>

      {modalOpen && (
        <GenerateHistoryModal
          shelterName={s.name}
          citations={sourcesForShelter.filter((src) => src.include_in_history)}
          events={generateEvents}
          pendingPermission={pendingPermission}
          onRespondPermission={handleRespondPermission}
          status={generateError ? 'error' : draftNarrative !== null ? 'done' : 'running'}
          narrative={draftNarrative}
          errorMessage={generateError}
          onAccept={() => {
            if (draftNarrative === null) return;
            dispatch(setHistoryContent(
              assembleAcceptedHistory(s.name, draftNarrative, sourcesForShelter.filter((src) => src.include_in_history)),
            ));
            setModalOpen(false);
            setDraftNarrative(null);
          }}
          onReject={closeGenerateModal}
        />
      )}
    </div>
  );
}
