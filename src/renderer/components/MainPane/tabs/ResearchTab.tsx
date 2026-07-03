import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput, WikiSearchResult } from '@shared/ipc-types';
import { wikiResultToSource } from '@shared/wiki-cite';
import { createSource } from '../../../store/sourcesSlice';
import { showToast } from '../../../store/uiSlice';
import { BLANK_SOURCE } from './sourceTypes';
import SourceModal from './SourceModal';

export default function ResearchTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WikiSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [noIndex, setNoIndex] = useState(false);
  const [editing, setEditing] = useState<(Partial<Source> & { shelter_id: number }) | null>(null);
  const [creating, setCreating] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await window.api.wiki.search(q.trim());
      setResults(res);
      setNoIndex(false);
    } catch {
      setNoIndex(true);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

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
            placeholder="Search newsletter archives…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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

  const meta = [
    result.publisher,
    result.printed_volume && `Vol. ${result.printed_volume}`,
    result.printed_issue && `No. ${result.printed_issue}`,
    [result.edition, result.volume].filter(Boolean).join(' '),
    result.page ? `p. ${result.page}` : '',
    result.kind === 'illustration' ? 'Illustration' : '',
  ].filter(Boolean).join(' · ');

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '10px 0',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{result.title}</div>
          {meta && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 6 }}>{meta}</div>
          )}
          {result.snippet && (
            <div
              className="research-snippet"
              style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}
              // Safe: snippet comes from our own FTS5 DB, not user input
              dangerouslySetInnerHTML={{ __html: result.snippet }}
            />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12 }}
            onClick={onAdd}
          >
            + Citation
          </button>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12 }}
            title="Open the source PDF at this page"
            onClick={async () => {
              const { ok } = await window.api.wiki.openPdf(result.resource, result.page || 1);
              setPdfMissing(!ok);
            }}
          >
            PDF p. {result.page || 1}
          </button>
          {pdfMissing && (
            <div style={{ fontSize: 11, color: 'var(--danger, #c0392b)', maxWidth: 140 }}>
              PDF not found — this collection may need to be re-added.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
