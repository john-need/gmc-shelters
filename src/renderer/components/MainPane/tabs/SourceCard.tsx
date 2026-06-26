import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { Source } from '../../../../shared/ipc-types';
import { citeChicago } from '../../../../shared/cite-chicago';
import { SOURCE_TYPES, SOURCE_GLYPH, prettyUrl } from './sourceTypes';

export interface SourceCardProps {
  s: Source;
  selected: boolean;
  onClick: () => void;
  onToggleInclude: (include: boolean) => void;
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

export default function SourceCard({ s, selected, onClick, onToggleInclude, onEdit, onDelete }: SourceCardProps) {
  const typeLabel = SOURCE_TYPES.find((t) => t.v === s.type)?.label ?? s.type;
  const html = citeChicago(s);
  const citationRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = citationRef.current;
    if (!el) return;
    const handle = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      if (a?.href) { e.preventDefault(); window.api?.shell.openExternal(a.href); }
    };
    el.addEventListener('click', handle);
    return () => el.removeEventListener('click', handle);
  }, []);

  return (
    <div className={`source-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      <div className={`source-type-badge ${s.type}`}>
        <span className="glyph">{SOURCE_GLYPH[s.type] ?? '?'}</span>
        <span className="label">{typeLabel}</span>
      </div>

      <div style={{ minWidth: 0 }}>
        <div ref={citationRef} className="source-citation" dangerouslySetInnerHTML={{ __html: html }} />

        <div className="source-meta-row">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={s.include_in_history}
              aria-label="Include in history"
              onChange={(e) => onToggleInclude(e.target.checked)}
            />
            <span>Include in history</span>
          </label>
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
          <button className="btn icon sm" title="Open in browser" onClick={() => window.api?.shell.openExternal(s.url)}>
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
