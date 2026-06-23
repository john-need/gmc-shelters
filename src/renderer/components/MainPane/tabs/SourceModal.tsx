import { useState } from 'react';
import type { Source, SourceType, SourceRef } from '../../../../shared/ipc-types';
import { citeChicago } from '../../../../shared/cite-chicago';
import { SOURCE_TYPES, BIB_KEYS, showSourceField, containerTitleLabel } from './sourceTypes';
import SourcePicker from './SourcePicker';

export interface SourceModalProps {
  source: Partial<Source> & { shelter_id: number };
  creating: boolean;
  onCancel: () => void;
  onSave: (s: Partial<Source> & { shelter_id: number }) => void;
}

interface SourceFormFieldsProps {
  s: Partial<Source> & { shelter_id: number };
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  showField: (key: string) => boolean;
  containerLabel: () => string;
  onOpenPicker: () => void;
}

function SourceFormFields({ s, set, showField, containerLabel, onOpenPicker }: SourceFormFieldsProps) {
  return (
    <div className="modal-body scroll">
      <div className="field-grid" style={{ marginBottom: 0 }}>
        <div className="field">
          <label className="label">Type</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select className="select" value={s.type} onChange={set('type')} style={{ flex: 1 }}>
              {SOURCE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <button type="button" className="btn icon" title="Browse existing sources" aria-label="Browse existing sources" disabled={!s.type} onClick={onOpenPicker}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
            </button>
          </div>
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
          <div className="field"><label className="label">Editor</label><input className="input" value={s.editor ?? ''} onChange={set('editor')} /></div>
        )}
        {showField('edition') && (
          <div className="field"><label className="label">Edition</label><input className="input mono" value={s.edition ?? ''} onChange={set('edition')} placeholder="28th" /></div>
        )}
        {showField('volume') && (
          <div className="field"><label className="label">Volume</label><input className="input mono" value={s.volume ?? ''} onChange={set('volume')} /></div>
        )}
        {showField('issue') && (
          <div className="field"><label className="label">Issue / no.</label><input className="input mono" value={s.issue ?? ''} onChange={set('issue')} /></div>
        )}
        {showField('pages') && (
          <div className="field"><label className="label">Pages</label><input className="input mono" value={s.pages ?? ''} onChange={set('pages')} placeholder="4–9" /></div>
        )}
        {showField('publisher') && (
          <div className="field"><label className="label">Publisher</label><input className="input" value={s.publisher ?? ''} onChange={set('publisher')} placeholder="Green Mountain Club" /></div>
        )}
        {showField('place') && (
          <div className="field"><label className="label">Place of publication</label><input className="input" value={s.place ?? ''} onChange={set('place')} placeholder="Waterbury Center, VT" /></div>
        )}
        {showField('date') && (
          <div className="field"><label className="label">Full date <span className="hint">YYYY-MM-DD</span></label><input className="input mono" type="date" value={s.date ?? ''} onChange={set('date')} /></div>
        )}
        {showField('archive') && (
          <div className="field"><label className="label">Archive / repository</label><input className="input" value={s.archive ?? ''} onChange={set('archive')} placeholder="Vermont Historical Society" /></div>
        )}
        {showField('archive_location') && (
          <div className="field col-span-2"><label className="label">Box / folder / call number</label><input className="input mono" value={s.archive_location ?? ''} onChange={set('archive_location')} placeholder="MSS 412, folder 4" /></div>
        )}

        <div className="field col-span-2">
          <label className="label">URL <span className="hint">opens in browser</span></label>
          <input className="input mono" value={s.url ?? ''} onChange={set('url')} placeholder="https://…" />
        </div>
        {showField('access_date') && s.url && (
          <div className="field"><label className="label">Access date</label><input className="input mono" type="date" value={s.access_date ?? ''} onChange={set('access_date')} /></div>
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
    </div>
  );
}

function CitationPreview({ html }: { html: string }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="label" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
        </svg>
        Live bibliography preview
      </div>
      <div
        style={{
          background: 'var(--bg-app)', border: '1px solid var(--line-2)',
          borderLeft: '3px solid var(--rust)', borderRadius: 4,
          padding: '14px 18px', fontFamily: 'var(--font-display)',
          fontSize: 15, lineHeight: 1.6, color: 'var(--ink-1)',
          textIndent: '-1em', paddingLeft: 'calc(18px + 1em)', minHeight: 60,
        }}
        dangerouslySetInnerHTML={{
          __html: html || "<span style='color:var(--ink-4);font-style:italic;font-size:13px;'>Fill in fields above to see the formatted citation.</span>",
        }}
      />
    </div>
  );
}

export default function SourceModal({ source, creating, onCancel, onSave }: SourceModalProps) {
  const [s, setS] = useState({ ...source });
  const [picking, setPicking] = useState(false);
  const [allSources, setAllSources] = useState<SourceRef[]>([]);

  const openPicker = async () => {
    if (!s.type) return;
    if (window.api) setAllSources(await window.api.sources.getAll());
    setPicking(true);
  };

  const handlePick = (ref: SourceRef) => {
    setS((cur) => {
      const next = { ...cur };
      for (const k of BIB_KEYS) (next as Record<string, unknown>)[k] = ref[k];
      return next;
    });
    setPicking(false);
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const v = e.target.type === 'number'
      ? (e.target.value === '' ? null : +e.target.value)
      : e.target.value;
    setS((cur) => ({ ...cur, [key]: v }));
  };

  const showField = (key: string) => showSourceField(key, s.type as SourceType, !!s.url);
  const containerLabel = () => containerTitleLabel(s.type as SourceType);
  const previewHtml = citeChicago(s as Source);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(s);
  };

  return (
    <div className="modal-bg" onClick={onCancel}>
      <form className="modal wide" style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>{creating ? 'Add a new source' : 'Edit source'}</h2>
          <div className="sub">Chicago Manual of Style · notes-bibliography</div>
        </div>
        <SourceFormFields s={s} set={set} showField={showField} containerLabel={containerLabel} onOpenPicker={openPicker} />
        <CitationPreview html={previewHtml} />

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

        <SourcePicker
          open={picking}
          type={s.type as SourceType}
          sources={allSources}
          onPick={handlePick}
          onClose={() => setPicking(false)}
        />
      </form>
    </div>
  );
}
