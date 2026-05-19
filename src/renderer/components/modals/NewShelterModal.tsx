import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { createShelter } from '../../store/sheltersSlice';
import { showToast, setActiveTab } from '../../store/uiSlice';

interface Props {
  onClose: () => void;
}

export default function NewShelterModal({ onClose }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const catList = useSelector((s: RootState) => s.categories.list);
  const [name, setName] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [category, setCategory] = useState('');
  const [isGmc, setIsGmc] = useState(true);

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'new-shelter';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const result = await dispatch(
      createShelter({ name: name.trim(), start_year: +year, category, is_gmc: isGmc }),
    );
    if (createShelter.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: `Created "${name.trim()}"` }));
      dispatch(setActiveTab('shelter'));
      onClose();
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-head">
          <h2>Add a new shelter record</h2>
          <div className="sub">§ creates row · creates folder · writes history.md</div>
        </div>
        <div className="modal-body">
          <div className="field">
            <label className="label">
              Name <span className="req">*</span>
            </label>
            <input
              className="input"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mossy Brook Shelter"
            />
          </div>
          <div className="field">
            <label className="label">
              Slug <span className="hint">auto-generated</span>
            </label>
            <input className="input mono" value={slug} disabled readOnly />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="field">
              <label className="label">Start year</label>
              <input
                className="input mono"
                type="number"
                value={year}
                onChange={(e) => setYear(+e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">Category</label>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">— none —</option>
                {catList.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div
            className={`check ${isGmc ? 'on' : ''}`}
            onClick={() => setIsGmc((x) => !x)}
            style={{ maxWidth: 'none' }}
          >
            <div className="check-box">
              {isGmc && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5 10 17 19 7.5"/>
                </svg>
              )}
            </div>
            <div className="check-text">
              <span className="check-title">Under GMC stewardship</span>
              <span className="check-sub">Maintained by the club</span>
            </div>
          </div>
          <div style={{
            background: 'var(--surface-2)', border: '1px solid var(--line)',
            borderRadius: 5, padding: '8px 10px',
            fontFamily: 'var(--font-mono)', fontSize: 10.5,
            color: 'var(--ink-3)', letterSpacing: '0.04em',
            lineHeight: 1.7,
          }}>
            <div>Will create:</div>
            <div style={{ color: 'var(--ink-1)' }}>· DB row in <strong>shelters</strong></div>
            <div style={{ color: 'var(--ink-1)' }}>· folder <strong>/shelters/{slug}/</strong></div>
            <div style={{ color: 'var(--ink-1)' }}>· file <strong>/shelters/{slug}/history.md</strong></div>
          </div>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn primary" disabled={!name.trim()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            {' '}Create record
          </button>
        </div>
      </form>
    </div>
  );
}
