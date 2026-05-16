import { useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { setHistoryContent, saveHistory } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';

function inline(s: string): string {
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function renderMarkdown(src: string): string {
  if (!src) return '';
  const lines = src.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      const lvl = m[1].length;
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (line.match(/^---+$/)) { out.push('<hr/>'); i++; continue; }
    if (line.match(/^>\s*/)) {
      const block: string[] = [];
      while (i < lines.length && lines[i].match(/^>\s*/)) {
        block.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote><p>' + inline(block.join(' ')) + '</p></blockquote>');
      continue;
    }
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push('<li>' + inline(lines[i].replace(/^[-*]\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ul>' + items.join('') + '</ul>');
      continue;
    }
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push('<li>' + inline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>');
        i++;
      }
      out.push('<ol>' + items.join('') + '</ol>');
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    const para = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^(#{1,3}\s|>\s|---+|[-*]\s|\d+\.\s)/)
    ) {
      para.push(lines[i]); i++;
    }
    out.push('<p>' + inline(para.join(' ')) + '</p>');
  }
  return out.join('\n');
}

export default function HistoryTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const value = useSelector((state: RootState) => state.shelters.historyContent);
  const dirty = useSelector((state: RootState) => state.shelters.historyDirty);
  const ref = useRef<HTMLTextAreaElement>(null);

  if (!s) return null;

  const wordCount = (value.match(/\S+/g) || []).length;
  const charCount = value.length;
  const lineCount = value.split('\n').length;

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
    const result = await dispatch(saveHistory({ slug: s.slug, content: value }));
    if (saveHistory.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: `Saved · /shelters/${s.slug}/history.md` }));
    }
  };

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

        <span className="md-tool-label">
          {dirty ? (
            <>
              <span style={{ color: 'var(--rust)', fontWeight: 600 }}>● Modified</span>
              {' · history.md'}
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-2px', marginRight: 4 }}>
                <path d="M5 12.5 10 17 19 7.5"/>
              </svg>
              Saved · history.md
            </>
          )}
        </span>
      </div>

      <div className="md-split">
        <div className="md-pane">
          <div className="md-pane-head">
            <span>Source</span>
            <span>
              <span className="filename">/shelters/{s.slug}/history.md</span>
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

        <div className="md-pane">
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
        <button className="btn sm primary" onClick={handleSave} disabled={!dirty}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
          </svg>
          {' '}Save file
        </button>
      </div>
    </div>
  );
}
