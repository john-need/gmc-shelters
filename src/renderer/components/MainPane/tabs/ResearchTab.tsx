import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput, WikiSearchResult, WebResearchResult, Shelter } from '@shared/ipc-types';
import { wikiResultToSource, stripMarks } from '@shared/wiki-cite';
import { webResultToSource } from '@shared/web-research-cite';
import { createSource } from '../../../store/sourcesSlice';
import { showToast } from '../../../store/uiSlice';
import { setQuery, setResults, setExcludedCollections } from '../../../store/researchSlice';
import { BLANK_SOURCE, SOURCE_TYPES, SOURCE_GLYPH } from './sourceTypes';
import SourceModal from './SourceModal';
import QuoteBlock from './QuoteBlock';

// ponytail: caps at 5 local hits so the prompt stays small — Claude only needs
// enough of what we already have to avoid duplicating it, not the full set.
function buildResearchContext(shelter: Shelter | null, collectionResults: WikiSearchResult[]): string | undefined {
  const parts: string[] = [];

  if (shelter) {
    const shelterLines = [
      `Shelter: ${shelter.name}`,
      shelter.start_year && `Built: ${shelter.start_year}${shelter.end_year ? `–${shelter.end_year}` : ''}`,
      shelter.architecture && `Architecture: ${shelter.architecture}`,
      shelter.built_by && `Built by: ${shelter.built_by}`,
      shelter.category && `Category: ${shelter.category}`,
      shelter.description && `Description: ${shelter.description}`,
    ].filter(Boolean).join('\n');
    parts.push(shelterLines);
  }

  if (collectionResults.length) {
    const lines = collectionResults.slice(0, 5)
      .map((r) => `- ${r.title}: ${stripMarks(r.snippet)}`)
      .join('\n');
    parts.push(`Already found in local collections (don't just repeat these — dig further):\n${lines}`);
  }

  return parts.length ? parts.join('\n\n') : undefined;
}

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

  const [webPhase, setWebPhase] = useState<'idle' | 'loading' | 'success' | 'empty' | 'no_api_key' | 'error'>('idle');
  const [webResults, setWebResults] = useState<WebResearchResult[]>([]);
  const [resultTab, setResultTab] = useState<'collections' | 'web'>('collections');
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  async function handleSearchWebClick() {
    const q = query.trim();
    if (!q || webPhase === 'loading') return;
    setResultTab('web');
    setWebPhase('loading');

    const res = await window.api.research.webSearch(q, buildResearchContext(s, results));

    if (!res.ok) {
      setWebPhase(res.error === 'no_api_key' ? 'no_api_key' : 'error');
      setWebResults([]);
      return;
    }
    setWebResults(res.results);
    setWebPhase(res.results.length ? 'success' : 'empty');
  }

  function openCitation(result: WikiSearchResult) {
    if (!s) return;
    setEditing({ ...BLANK_SOURCE, ...wikiResultToSource(result), shelter_id: s.id });
    setCreating(true);
  }

  function openWebCitation(result: WebResearchResult) {
    if (!s) return;
    setEditing({ ...BLANK_SOURCE, ...webResultToSource(result), shelter_id: s.id });
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
          <input
            className="input"
            style={{ flex: 1 }}
            type="search"
            placeholder='Search newsletter archives… ("exact phrase" for an exact match)'
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
            autoFocus
          />
          <button
            type="button"
            className="btn primary"
            style={{ height: 'auto' }}
            disabled={!query.trim() || webPhase === 'loading'}
            onClick={handleSearchWebClick}
          >
            Research w/AI
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          {(collectionsLoading || collectionNames.length > 0) && (
            <button type="button" className="btn ghost sm" onClick={() => setFiltersOpen((v) => !v)}>
              Collection filters
            </button>
          )}
        </div>

        {(collectionsLoading || collectionNames.length > 0) && (
          <div
            style={{
              display: 'grid',
              gridTemplateRows: filtersOpen ? '1fr' : '0fr',
              transition: 'grid-template-rows 200ms ease',
              overflow: 'hidden',
            }}
          >
            <div style={{ minHeight: 0 }} aria-hidden={!filtersOpen}>
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
            </div>
          </div>
        )}
        <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      </div>

      <div className="tabs" style={{ flexShrink: 0 }}>
        <button
          type="button"
          className={`tab ${resultTab === 'collections' ? 'active' : ''}`}
          onClick={() => setResultTab('collections')}
        >
          Collections ({results.length})
        </button>
        <button
          type="button"
          className={`tab ${resultTab === 'web' ? 'active' : ''}`}
          onClick={() => setResultTab('web')}
        >
          Web Sources ({webResults.length})
        </button>
      </div>

      {resultTab === 'collections' && (
        <div className="settings-card tab-fade" style={{ padding: '8px 16px', marginBottom: 0, flex: 1, overflowY: 'auto' }}>
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

          {!noIndex && !query && results.length === 0 && (
            <div style={{ padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              No active search. Type a query above to search the collections.
            </div>
          )}

          {results.map((r, i) => (
            <ResultCard key={`${r.path}:${r.kind}:${r.page}:${i}`} result={r} onAdd={() => openCitation(r)} />
          ))}
        </div>
      )}

      {resultTab === 'web' && (
        <div className="settings-card tab-fade" style={{ padding: '8px 16px', marginBottom: 0, flex: 1, overflowY: 'auto' }}>
          {webPhase === 'idle' && (
            <div style={{ padding: '24px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              Click Search Web to research this query.
            </div>
          )}
          {webPhase === 'loading' && (
            <div style={{ padding: '12px 0', color: 'var(--ink-3)', fontSize: 13 }}>Searching the web…</div>
          )}
          {webPhase === 'no_api_key' && (
            <div style={{ padding: '12px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              No Anthropic API key configured — add one in Settings → AI Settings.
            </div>
          )}
          {webPhase === 'error' && (
            <div style={{ padding: '12px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              Web search failed — try again.
            </div>
          )}
          {webPhase === 'empty' && (
            <div style={{ padding: '12px 0', color: 'var(--ink-3)', fontSize: 13 }}>
              No web sources found for <em>{query}</em>
            </div>
          )}
          {webPhase === 'success' && webResults.map((r, i) => (
            <WebResultCard key={`${r.url}:${i}`} result={r} onAdd={() => openWebCitation(r)} />
          ))}
        </div>
      )}

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

function WebResultCard({ result, onAdd }: { result: WebResearchResult; onAdd: () => void }) {
  return (
    <div className="research-result">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {result.localImagePath && (
          <img
            src={`shelter://${encodeURI(result.localImagePath)}`}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="source-header" style={{ marginBottom: 2 }}>
            <a className="source-title" href={result.url} target="_blank" rel="noreferrer">{result.title}</a>
          </div>
          {result.snippet && <div style={{ fontSize: 12.5, marginTop: 2 }}>{result.snippet}</div>}
        </div>
        <div style={{ flexShrink: 0 }}>
          <button type="button" className="btn icon sm" title="Add citation" onClick={onAdd}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
