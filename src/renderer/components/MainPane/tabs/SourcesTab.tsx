import { useState, useMemo, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Source, SourceInput, SourceType } from '../../../../shared/ipc-types';
import { createSource, updateSource, deleteSource } from '../../../store/sourcesSlice';
import { citeChicago } from '../../../../shared/cite-chicago';

const SOURCE_TYPES: { v: SourceType; label: string }[] = [
  { v: 'book', label: 'Book' },
  { v: 'chapter', label: 'Book chapter' },
  { v: 'journal', label: 'Journal article' },
  { v: 'newspaper', label: 'Newspaper article' },
  { v: 'magazine', label: 'Magazine article' },
  { v: 'website', label: 'Website' },
  { v: 'archive', label: 'Archive material' },
  { v: 'manuscript', label: 'Manuscript / letter' },
  { v: 'interview', label: 'Interview' },
  { v: 'map', label: 'Map' },
  { v: 'report', label: 'Report / govt. document' },
  { v: 'other', label: 'Other' },
];

const SOURCE_GLYPH: Record<string, string> = {
  book: 'B', chapter: 'C', journal: 'J', newspaper: 'N',
  magazine: 'M', website: 'W', archive: 'A', manuscript: 'M',
  interview: 'I', map: 'P', report: 'R', other: '?',
};

function prettyUrl(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u; }
}

const BLANK_SOURCE: Omit<Source, 'id' | 'shelter_id' | 'created' | 'updated'> = {
  type: 'book',
  author: '', title: '', container_title: '', editor: '',
  edition: '', volume: '', issue: '', pages: '',
  publisher: '', place: '', year: null, date: '',
  url: '', access_date: '', archive: '', archive_location: '',
  annotation: '', notes: '', quote: '',
};

interface SourceCardProps {
  s: Source;
  selected: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SourceQuote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div className="source-quote-wrap" onClick={(e) => e.stopPropagation()}>
      <div ref={ref} className={`source-quote${expanded ? ' expanded' : ''}`}>
        &ldquo;{text}&rdquo;
      </div>
      {overflows && (
        <button className="source-quote-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  );
}

function SourceCard({ s, selected, onClick, onEdit, onDelete }: SourceCardProps) {
  const typeLabel = SOURCE_TYPES.find((t) => t.v === s.type)?.label ?? s.type;
  const html = citeChicago(s);

  return (
    <div className={`source-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className={`source-type-badge ${s.type}`}>
        <span className="glyph">{SOURCE_GLYPH[s.type] ?? '?'}</span>
        <span className="label">{typeLabel}</span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="source-citation" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="source-meta-row">
          {s.year && <span className="chip">{s.year}</span>}
          {s.pages && <span className="chip">pp. {s.pages}</span>}
          {s.archive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>
              </svg>
              {s.archive}
            </span>
          )}
          {s.url && (
            <a href={s.url} onClick={(e) => { e.stopPropagation(); if (window.api) window.api.shell.openExternal(s.url); e.preventDefault(); }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>
              </svg>
              {' '}{prettyUrl(s.url)}
            </a>
          )}
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>updated {s.updated}</span>
        </div>

        {s.quote && <SourceQuote text={s.quote} />}

        {s.annotation && selected && (
          <div className="source-annotation">{s.annotation}</div>
        )}
      </div>

      <div className="source-actions" onClick={(e) => e.stopPropagation()}>
        {s.url && (
          <button className="btn icon sm" title="Open in browser"
            onClick={() => window.api?.shell.openExternal(s.url)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>
            </svg>
          </button>
        )}
        <button className="btn icon sm" title="Edit source" onClick={onEdit}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button className="btn icon sm" title="Delete source" onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

interface SourceModalProps {
  source: Partial<Source> & { shelter_id: number };
  creating: boolean;
  onCancel: () => void;
  onSave: (s: Partial<Source> & { shelter_id: number }) => void;
}

function SourceModal({ source, creating, onCancel, onSave }: SourceModalProps) {
  const [s, setS] = useState({ ...source });

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.type === 'number'
      ? (e.target.value === '' ? null : +e.target.value)
      : e.target.value;
    setS((cur) => ({ ...cur, [key]: v }));
  };

  const showField = (key: string): boolean => {
    const t = s.type as SourceType;
    const map: Record<string, boolean | SourceType[]> = {
      author: true,
      title: true,
      container_title: (['chapter', 'journal', 'newspaper', 'magazine', 'website', 'archive'] as SourceType[]).includes(t),
      editor: (['book', 'chapter', 'report'] as SourceType[]).includes(t),
      edition: (['book', 'chapter', 'report'] as SourceType[]).includes(t),
      volume: (['journal', 'magazine', 'report'] as SourceType[]).includes(t),
      issue: (['journal', 'magazine'] as SourceType[]).includes(t),
      pages: (['book', 'chapter', 'journal', 'newspaper', 'magazine', 'report'] as SourceType[]).includes(t),
      publisher: (['book', 'chapter', 'website', 'report', 'map'] as SourceType[]).includes(t),
      place: (['book', 'chapter', 'report', 'map', 'interview'] as SourceType[]).includes(t),
      year: true,
      date: (['newspaper', 'magazine', 'website', 'interview'] as SourceType[]).includes(t),
      url: true,
      access_date: (['website', 'journal'] as SourceType[]).includes(t) || !!s.url,
      archive: (['archive', 'manuscript', 'interview'] as SourceType[]).includes(t),
      archive_location: (['archive', 'manuscript', 'interview'] as SourceType[]).includes(t),
    };
    const v = map[key];
    return typeof v === 'boolean' ? v : Array.isArray(v) ? v.includes(t) : false;
  };

  const containerLabel = () => {
    const t = s.type;
    if (t === 'journal' || t === 'magazine') return 'Journal / magazine';
    if (t === 'newspaper') return 'Newspaper';
    if (t === 'website') return 'Website name';
    if (t === 'archive') return 'Collection';
    return 'Container title';
  };

  const previewHtml = citeChicago(s as Source);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(s);
  };

  return (
    <div className="modal-bg" onClick={onCancel}>
      <form className="modal wide" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>{creating ? 'Add a new source' : 'Edit source'}</h2>
          <div className="sub">Chicago Manual of Style · notes-bibliography</div>
        </div>
        <div className="modal-body scroll">
          <div className="field-grid" style={{ marginBottom: 0 }}>
            <div className="field">
              <label className="label">Type</label>
              <select className="select" value={s.type} onChange={set('type')}>
                {SOURCE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Year</label>
              <input className="input mono" type="number" value={s.year ?? ''} onChange={set('year')} placeholder="1947" />
            </div>
          </div>

          <div className="field-grid" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="field col-span-2">
              <label className="label">Author <span className="hint">&quot;Last, First&quot; — leave blank for institutional</span></label>
              <input className="input" value={s.author ?? ''} onChange={set('author')} placeholder="Calloway, Henry" />
            </div>
            <div className="field col-span-2">
              <label className="label">Title <span className="hint">no surrounding quotes</span></label>
              <input className="input" value={s.title ?? ''} onChange={set('title')} placeholder="A Hearth on Birch Glen" />
            </div>

            {showField('container_title') && (
              <div className="field col-span-2">
                <label className="label">{containerLabel()}</label>
                <input className="input" value={s.container_title ?? ''} onChange={set('container_title')} placeholder="Long Trail News" />
              </div>
            )}

            {showField('editor') && (
              <div className="field">
                <label className="label">Editor</label>
                <input className="input" value={s.editor ?? ''} onChange={set('editor')} />
              </div>
            )}

            {showField('edition') && (
              <div className="field">
                <label className="label">Edition</label>
                <input className="input mono" value={s.edition ?? ''} onChange={set('edition')} placeholder="28th" />
              </div>
            )}

            {showField('volume') && (
              <div className="field">
                <label className="label">Volume</label>
                <input className="input mono" value={s.volume ?? ''} onChange={set('volume')} />
              </div>
            )}

            {showField('issue') && (
              <div className="field">
                <label className="label">Issue / no.</label>
                <input className="input mono" value={s.issue ?? ''} onChange={set('issue')} />
              </div>
            )}

            {showField('pages') && (
              <div className="field">
                <label className="label">Pages</label>
                <input className="input mono" value={s.pages ?? ''} onChange={set('pages')} placeholder="4–9" />
              </div>
            )}

            {showField('publisher') && (
              <div className="field">
                <label className="label">Publisher</label>
                <input className="input" value={s.publisher ?? ''} onChange={set('publisher')} placeholder="Green Mountain Club" />
              </div>
            )}

            {showField('place') && (
              <div className="field">
                <label className="label">Place of publication</label>
                <input className="input" value={s.place ?? ''} onChange={set('place')} placeholder="Waterbury Center, VT" />
              </div>
            )}

            {showField('date') && (
              <div className="field">
                <label className="label">Full date <span className="hint">YYYY-MM-DD</span></label>
                <input className="input mono" type="date" value={s.date ?? ''} onChange={set('date')} />
              </div>
            )}

            {showField('archive') && (
              <div className="field">
                <label className="label">Archive / repository</label>
                <input className="input" value={s.archive ?? ''} onChange={set('archive')} placeholder="Vermont Historical Society" />
              </div>
            )}

            {showField('archive_location') && (
              <div className="field col-span-2">
                <label className="label">Box / folder / call number</label>
                <input className="input mono" value={s.archive_location ?? ''} onChange={set('archive_location')} placeholder="MSS 412, folder 4" />
              </div>
            )}

            <div className="field col-span-2">
              <label className="label">URL <span className="hint">opens in browser</span></label>
              <input className="input mono" value={s.url ?? ''} onChange={set('url')} placeholder="https://…" />
            </div>

            {showField('access_date') && s.url && (
              <div className="field">
                <label className="label">Access date</label>
                <input className="input mono" type="date" value={s.access_date ?? ''} onChange={set('access_date')} />
              </div>
            )}

            <div className="field col-span-2">
              <label className="label">Verbatim quote <span className="hint">exact words from the source</span></label>
              <textarea className="textarea" rows={3} value={s.quote ?? ''} onChange={set('quote')} />
            </div>

            <div className="field col-span-2">
              <label className="label">Annotation <span className="hint">summary / why this matters</span></label>
              <textarea className="textarea" rows={2} value={s.annotation ?? ''} onChange={set('annotation')} />
            </div>

            <div className="field col-span-2">
              <label className="label">Internal notes</label>
              <textarea className="textarea" rows={2} value={s.notes ?? ''} onChange={set('notes')} />
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              Live bibliography preview
            </div>
            <div
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--line-2)',
                borderLeft: '3px solid var(--rust)',
                borderRadius: 4,
                padding: '14px 18px',
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--ink-1)',
                textIndent: '-1em',
                paddingLeft: 'calc(18px + 1em)',
                minHeight: 60,
              }}
              dangerouslySetInnerHTML={{
                __html: previewHtml ||
                  "<span style='color:var(--ink-4);font-style:italic;font-size:13px;'>Fill in fields above to see the formatted citation.</span>",
              }}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary">
            {creating ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                {' '}Add source
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
                </svg>
                {' '}Save
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

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
    const next = order[(order.indexOf(sort) + 1) % order.length];
    setSort(next);
  };

  const startCreate = () => {
    setEditing({ ...BLANK_SOURCE, shelter_id: s.id });
    setCreating(true);
  };

  const startEdit = (src: Source) => {
    setEditing({ ...src });
    setCreating(false);
  };

  const cancelEdit = () => { setEditing(null); setCreating(false); };

  const handleSave = async (edited: Partial<Source> & { shelter_id: number }) => {
    if (creating) {
      const result = await dispatch(createSource(edited as SourceInput));
      if (createSource.fulfilled.match(result)) {
        setSelectedId(result.payload.source.id);
      }
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
        <SourceModal
          source={editing}
          creating={creating}
          onCancel={cancelEdit}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
