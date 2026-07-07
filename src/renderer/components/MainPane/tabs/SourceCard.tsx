import { useLayoutEffect, useRef } from 'react';
import type { Source } from '../../../../shared/ipc-types';
import { citeChicago } from '../../../../shared/cite-chicago';
import { SOURCE_TYPES, SOURCE_GLYPH, prettyUrl, collectionResource } from './sourceTypes';
import QuoteBlock from './QuoteBlock';

export interface SourceCardProps {
  s: Source;
  onToggleInclude: (include: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SourceCard({ s, onToggleInclude, onEdit, onDelete }: SourceCardProps) {
  const typeLabel = SOURCE_TYPES.find((t) => t.v === s.type)?.label ?? s.type;
  const html = citeChicago(s, true);
  const citationRef = useRef<HTMLDivElement>(null);
  const resource = collectionResource(s);

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
    <div className="source-card">
      <div className="source-type-col">
        <div className={`source-type-badge ${s.type}`}>
          <span className="glyph">{SOURCE_GLYPH[s.type] ?? '?'}</span>
          <span className="label">{typeLabel}</span>
        </div>
        <div className="include-toggle">
          <label className="toggle-switch" title="Include in history">
            <input
              type="checkbox"
              checked={s.include_in_history}
              aria-label="Include in history"
              onChange={(e) => onToggleInclude(e.target.checked)}
            />
            <span className="toggle-track" />
          </label>
          <span className="toggle-label">Cite This</span>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div className="source-header">
          <span className="source-title">{s.title || 'Untitled source'}</span>
          {(s.year || s.date) && <span className="source-pubdate">{s.year || s.date}</span>}
          <span style={{
            marginLeft: 'auto', opacity: 0.7,
            fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.04em', color: 'var(--ink-3)',
          }}>
            updated {s.updated}
          </span>
        </div>

        <div ref={citationRef} className="source-citation" dangerouslySetInnerHTML={{ __html: html }} />

        {(s.archive || s.url) && (
        <div className="source-meta-row">
          {s.archive && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 11v6c0 1.7 4 3 9 3s9-1.3 9-3v-6"/>
              </svg>
              {s.archive}
            </span>
          )}
          {s.url && (
            <a href={s.url} onClick={(e) => { e.preventDefault(); if (window.api) window.api.shell.openExternal(s.url); }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>
              </svg>
              {' '}{prettyUrl(s.url)}
            </a>
          )}
        </div>
        )}

        {s.quote && <QuoteBlock text={s.quote} />}

        {s.annotation && (
          <div className="source-annotation">{s.annotation}</div>
        )}
      </div>

      <div className="source-actions">
        <button
          className="btn icon sm"
          title={resource ? 'View PDF' : s.url ? 'Open in browser' : 'No document or URL'}
          disabled={!resource && !s.url}
          onClick={() => {
            if (resource) window.api?.wiki.openPdf(resource, parseInt(s.pages, 10) || 1);
            else if (s.url) window.api?.shell.openExternal(s.url);
          }}
        >
          {resource ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l2-2"/>
            </svg>
          )}
        </button>
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
