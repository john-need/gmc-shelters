import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput, WikiSearchResult } from '@shared/ipc-types';
import { wikiResultToSource } from '@shared/wiki-cite';
import { createSource } from '../../../store/sourcesSlice';
import { showToast } from '../../../store/uiSlice';
import { setQuery, setResults } from '../../../store/researchSlice';
import { BLANK_SOURCE, SOURCE_TYPES, SOURCE_GLYPH } from './sourceTypes';
import SourceModal from './SourceModal';
import QuoteBlock from './QuoteBlock';

export default function ResearchTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const query = useSelector((state: RootState) => state.research.query);
  const results = useSelector((state: RootState) => state.research.results);

  const [loading, setLoading] = useState(false);
  const [noIndex, setNoIndex] = useState(false);
  const [editing, setEditing] = useState<(Partial<Source> & { shelter_id: number }) | null>(null);
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { dispatch(setResults([])); return; }
    setLoading(true);
    try {
      const res = await window.api.wiki.search(q.trim());
      dispatch(setResults(res));
      setNoIndex(false);
    } catch {
      setNoIndex(true);
      dispatch(setResults([]));
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Skip the very first run: `query` may already be populated from a persisted
  // search (tab switch or shelter change), whose matching `results` are already
  // in the store — re-searching on mount would refetch what's already shown.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!query.trim()) { dispatch(setResults([])); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search, dispatch]);

  function openCitation(result: WikiSearchResult) {
    if (!s) return;
    setEditing({ ...BLANK_SOURCE, ...wikiResultToSource(result), shelter_id: s.id });
    setCreating(true);
  }

  async function handleSave(src: Partial<Source> & { shelter_id: number }) {
    await dispatch(createSource(src as SourceInput));
    dispatch(showToast({ id: 'wiki-cite', message: 'Citation added to Sources tab' }));
    setEditing(null);
    setCreating(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="search"
            placeholder='Search newsletter archives… ("exact phrase" for an exact match)'
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
            autoFocus
          />
        </div>
        {results.length > 0 && !loading && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {noIndex && (
          <div style={{ padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
            No search index found.{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              Run scripts/build_wiki_index.py to build it.
            </span>
          </div>
        )}

        {!noIndex && !loading && query && results.length === 0 && (
          <div style={{ padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
            No results for <em>{query}</em>
          </div>
        )}

        {results.map((r, i) => (
          <ResultCard key={`${r.path}:${r.kind}:${r.page}:${i}`} result={r} onAdd={() => openCitation(r)} />
        ))}
      </div>

      {editing && (
        <SourceModal
          source={editing}
          creating={creating}
          onCancel={() => { setEditing(null); setCreating(false); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ResultCard({ result, onAdd }: { result: WikiSearchResult; onAdd: () => void }) {
  const [pdfMissing, setPdfMissing] = useState(false);

  const source = { ...BLANK_SOURCE, ...wikiResultToSource(result) } as Source;
  const typeLabel = SOURCE_TYPES.find((t) => t.v === source.type)?.label ?? source.type;
  const title = source.title || source.container_title;
  const titleMeta = [source.edition && `ed. ${source.edition}`, source.date && `(${source.date})`].filter(Boolean).join(' ');
  const line2 = [source.author, source.publisher, source.pages && `Pp. ${source.pages}`]
    .filter(Boolean).join(', ');

  return (
    <div className="research-result">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div className={`source-type-badge ${source.type}`}>
          <span className="glyph">{SOURCE_GLYPH[source.type] ?? '?'}</span>
          <span className="label">{typeLabel}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {result.kind === 'illustration' && (
            <span className="chip" style={{ display: 'inline-block', marginBottom: 4 }}>Illustration</span>
          )}
          {(title || titleMeta) && (
            <div className="source-header" style={{ marginBottom: 2 }}>
              {title && <span className="source-title">{title}</span>}
              {titleMeta && <span className="source-pubdate">{titleMeta}</span>}
            </div>
          )}
          {line2 && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{line2}</div>}
          {result.snippet && <QuoteBlock html={result.snippet} />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="btn icon sm"
            title="Add citation"
            onClick={onAdd}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
          <button
            type="button"
            className="btn icon sm"
            title={`Open PDF at page ${result.page || 1}`}
            onClick={async () => {
              const { ok } = await window.api.wiki.openPdf(result.resource, result.page || 1);
              setPdfMissing(!ok);
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
            </svg>
          </button>
          {pdfMissing && (
            <div style={{ fontSize: 11, color: 'var(--danger, #c0392b)', maxWidth: 140, textAlign: 'right' }}>
              PDF not found — this collection may need to be re-added.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
