import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput, WikiSearchResult } from '@shared/ipc-types';
import { wikiResultToSource } from '@shared/wiki-cite';
import { createSource } from '../../../store/sourcesSlice';
import { showToast } from '../../../store/uiSlice';
import { setQuery, setResults, setExcludedCollections } from '../../../store/researchSlice';
import { BLANK_SOURCE, SOURCE_TYPES, SOURCE_GLYPH } from './sourceTypes';
import SourceModal from './SourceModal';
import QuoteBlock from './QuoteBlock';

export default function ResearchTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const query = useSelector((state: RootState) => state.research.query);
  const results = useSelector((state: RootState) => state.research.results);
  const excludedCollections = useSelector((state: RootState) => state.research.excludedCollections);

  const [loading, setLoading] = useState(false);
  const [noIndex, setNoIndex] = useState(false);
  const [editing, setEditing] = useState<(Partial<Source> & { shelter_id: number }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [collectionNames, setCollectionNames] = useState<string[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);

  useEffect(() => {
    window.api.collections.status()
      .then((cs) => setCollectionNames(cs.map((c) => c.name)))
      .finally(() => setCollectionsLoading(false));
  }, []);

  const search = useCallback(async (q: string, excluded: string[]) => {
    if (!q.trim()) { dispatch(setResults([])); return; }
    setLoading(true);
    try {
      const res = excluded.length
        ? await window.api.wiki.search(q.trim(), collectionNames.filter((n) => !excluded.includes(n)))
        : await window.api.wiki.search(q.trim());
      dispatch(setResults(res));
      setNoIndex(false);
    } catch {
      setNoIndex(true);
      dispatch(setResults([]));
    } finally {
      setLoading(false);
    }
  }, [dispatch, collectionNames]);

  // Skip the very first run: `query` may already be populated from a persisted
  // search (tab switch or shelter change), whose matching `results` are already
  // in the store — re-searching on mount would refetch what's already shown.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!query.trim()) { dispatch(setResults([])); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => search(query, excludedCollections), 300);
    return () => clearTimeout(t);
  }, [query, excludedCollections, search, dispatch]);

  function toggleCollection(name: string) {
    dispatch(setExcludedCollections(
      excludedCollections.includes(name)
        ? excludedCollections.filter((n) => n !== name)
        : [...excludedCollections, name],
    ));
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12, padding: '12px 16px', overflow: 'hidden' }}>
      <div className="settings-card" style={{ padding: '16px', marginBottom: 0, flexShrink: 0 }}>
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

        {(collectionsLoading || collectionNames.length > 0) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Collections
              </span>
              {collectionsLoading ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
              ) : (
                <>
                  <button type="button" className="btn ghost sm" onClick={() => dispatch(setExcludedCollections([]))}>
                    All
                  </button>
                  <button type="button" className="btn ghost sm" onClick={() => dispatch(setExcludedCollections(collectionNames))}>
                    None
                  </button>
                </>
              )}
            </div>
            {!collectionsLoading && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {collectionNames.map((name) => (
                  <label key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!excludedCollections.includes(name)}
                      onChange={() => toggleCollection(name)}
                    />
                    {name}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>

      <div className="settings-card" style={{ padding: '8px 16px', marginBottom: 0, flex: 1, overflowY: 'auto' }}>
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
