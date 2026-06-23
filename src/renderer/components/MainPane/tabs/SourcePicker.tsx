import { useState, useMemo, useEffect } from 'react';
import type { SourceType, SourceRef } from '../../../../shared/ipc-types';
import { PICKER_FIELDS, cell } from './sourceTypes';

export interface SourcePickerProps {
  open: boolean;
  type: SourceType;
  sources: SourceRef[];
  onPick: (ref: SourceRef) => void;
  onClose: () => void;
}

export default function SourcePicker({ open, type, sources, onPick, onClose }: SourcePickerProps) {
  const fields = useMemo(() => PICKER_FIELDS[type] ?? [], [type]);
  const [queries, setQueries] = useState<Record<string, string>>({});

  // Reset searches whenever the picker is re-opened or the type changes.
  useEffect(() => { if (open) setQueries({}); }, [open, type]);

  const rows = useMemo(() => {
    const matching = sources.filter((r) => r.type === type);
    // De-duplicate by the visible field signature.
    const seen = new Set<string>();
    const unique = matching.filter((r) => {
      const sig = fields.map((f) => cell(r[f.key])).join('');
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
    const filtered = unique.filter((r) =>
      fields.every((f) => {
        const q = (queries[f.key] ?? '').trim().toLowerCase();
        return q === '' || cell(r[f.key]).toLowerCase().includes(q);
      }),
    );
    return filtered.sort((a, b) => {
      const titleCmp = cell(a.title).localeCompare(cell(b.title), undefined, { sensitivity: 'base' });
      if (titleCmp !== 0) return titleCmp;
      return (a.year ?? 0) - (b.year ?? 0);
    });
  }, [sources, type, fields, queries]);

  return (
    <div className={`source-picker${open ? ' open' : ''}`} aria-hidden={!open}>
      {open && (
        <>
          <div className="modal-head">
            <h2>Reuse an existing source</h2>
            <div className="sub">Pick a {type} already on record to fill in the form</div>
          </div>
          <div className="source-picker-grid" style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}>
            {fields.map((f) => (
              <input
                key={f.key}
                className="input"
                aria-label={`Search ${f.label}`}
                placeholder={f.label}
                value={queries[f.key] ?? ''}
                onChange={(e) => setQueries((q) => ({ ...q, [f.key]: e.target.value }))}
              />
            ))}
          </div>
          <div className="source-picker-rows">
            {rows.length === 0 ? (
              <div className="sources-empty"><div style={{ fontSize: 12, color: 'var(--ink-3)' }}>No matching sources.</div></div>
            ) : (
              rows.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  data-testid={`picker-row-${r.id}`}
                  className="source-picker-row"
                  style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr)` }}
                  onClick={() => onPick(r)}
                >
                  {fields.map((f) => (
                    <span key={f.key} className="cell">{cell(r[f.key]) || '—'}</span>
                  ))}
                </button>
              ))
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Back</button>
          </div>
        </>
      )}
    </div>
  );
}
