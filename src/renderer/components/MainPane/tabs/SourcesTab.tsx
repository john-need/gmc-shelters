import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput } from '@shared/ipc-types';
import { createSource, updateSource, deleteSource } from '../../../store/sourcesSlice';
import { SOURCE_TYPES, BLANK_SOURCE } from './sourceTypes';
import SourceCard from './SourceCard';
import SourceModal from './SourceModal';

export default function SourcesTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const sources = useSelector((state: RootState) =>
    s ? (state.sources.byShelter[s.id] ?? []) : [],
  );

  const [query, setQuery] = useState('');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState<'author' | 'year' | 'title' | 'type'>('author');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [editing, setEditing] = useState<(Partial<Source> & { shelter_id: number }) | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!s) return [];
    let xs = [...sources];
    if (type !== 'all') xs = xs.filter((src) => src.type === type);
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter((src) =>
        (src.author || '').toLowerCase().includes(q) ||
        (src.title || '').toLowerCase().includes(q) ||
        (src.container_title || '').toLowerCase().includes(q) ||
        (src.publisher || '').toLowerCase().includes(q) ||
        (src.annotation || '').toLowerCase().includes(q) ||
        String(src.year || '').includes(q),
      );
    }
    xs.sort((a, b) => {
      let av: string | number, bv: string | number;
      if (sort === 'author') { av = (a.author || 'zzz').toLowerCase(); bv = (b.author || 'zzz').toLowerCase(); }
      else if (sort === 'title') { av = (a.title || '').toLowerCase(); bv = (b.title || '').toLowerCase(); }
      else if (sort === 'year') { av = a.year ?? 0; bv = b.year ?? 0; }
      else { av = a.type; bv = b.type; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return xs;
  }, [s, sources, query, type, sort, sortDir]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    sources.forEach((src) => { c[src.type] = (c[src.type] ?? 0) + 1; });
    return c;
  }, [sources]);

  if (!s) return null;

  const cycleSortField = () => {
    const order: typeof sort[] = ['author', 'year', 'title', 'type'];
    setSort(order[(order.indexOf(sort) + 1) % order.length]);
  };

  const startCreate = () => {
    setEditing({ ...BLANK_SOURCE, shelter_id: s.id });
    setCreating(true);
  };

  const startEdit = (src: Source) => { setEditing({ ...src }); setCreating(false); };
  const cancelEdit = () => { setEditing(null); setCreating(false); };

  const handleSave = async (edited: Partial<Source> & { shelter_id: number }) => {
    if (creating) {
      const result = await dispatch(createSource(edited as SourceInput));
      if (createSource.fulfilled.match(result)) setSelectedId(result.payload.source.id);
    } else {
      await dispatch(updateSource(edited as Source));
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    const src = sources.find((x) => x.id === id);
    if (!confirm(`Delete this source?\n\n${src?.author || src?.title || 'Unnamed source'}`)) return;
    await dispatch(deleteSource({ id, shelterId: s.id }));
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="sources-wrap">
      <div className="sources-list-wrap">
        <div className="sources-toolbar">
          <div className="sources-search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
            </svg>
            <input
              placeholder="Search authors, titles, journals…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="md-tool" style={{ width: 20, height: 20 }} onClick={() => setQuery('')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6 18 18M18 6 6 18"/>
                </svg>
              </button>
            )}
          </div>

          <select className="type-filter" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types ({sources.length})</option>
            {SOURCE_TYPES.map((t) => (
              <option key={t.v} value={t.v}>{t.label} ({counts[t.v] ?? 0})</option>
            ))}
          </select>

          <button className="sort-button" onClick={cycleSortField} title="Cycle sort field">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M7 12h10M10 18h4"/>
            </svg>
            {' '}Sort: <strong style={{ color: 'var(--ink-1)' }}>{sort}</strong>
          </button>

          <button className="sort-button" onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}>
            {sortDir === 'asc' ? '↑ A→Z' : '↓ Z→A'}
          </button>

          <div style={{ flex: 1 }} />

          <button className="btn primary" onClick={startCreate}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {' '}Add source
          </button>
        </div>

        <div className="sources-list">
          {filtered.length === 0 ? (
            <div className="sources-empty">
              <div className="display">
                {sources.length === 0 ? 'No sources cited yet.' : 'No sources match your filter.'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {sources.length === 0
                  ? 'Add the first reference — Long Trail News, club books, archive folders, web pages.'
                  : 'Try clearing the search or filter.'}
              </div>
              {sources.length === 0 && (
                <button className="btn primary" style={{ marginTop: 16 }} onClick={startCreate}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  {' '}Add first source
                </button>
              )}
            </div>
          ) : (
            filtered.map((src) => (
              <SourceCard
                key={src.id}
                s={src}
                selected={src.id === selectedId}
                onClick={() => setSelectedId(src.id === selectedId ? null : src.id)}
                onToggleInclude={(include) => { void dispatch(updateSource({ ...src, include_in_history: include })); }}
                onEdit={() => startEdit(src)}
                onDelete={() => handleDelete(src.id)}
              />
            ))
          )}
        </div>

        <div className="sources-status">
          <span>{filtered.length} of {sources.length} shown</span>
          <span>·</span>
          <span>style: <strong style={{ color: 'var(--ink-1)' }}>Chicago (NB)</strong></span>
          <span>·</span>
          <span>stored in <strong style={{ color: 'var(--ink-1)' }}>sources.db</strong> · shelter_id = {s.id}</span>
          <span style={{ marginLeft: 'auto' }}>{sources.filter((src) => src.url).length} with URL</span>
        </div>
      </div>

      {editing && (
        <SourceModal source={editing} creating={creating} onCancel={cancelEdit} onSave={handleSave} />
      )}
    </div>
  );
}
