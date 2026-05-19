import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { setEditBuffer, revertEditBuffer, saveShelter } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import type { Shelter } from '../../../../shared/ipc-types';

const CATEGORIES = ['Lodge', 'Cabin', 'Shelter', 'Lean-to', 'Camp', 'Privy', 'Other'];

function FlagCheck({
  on,
  onClick,
  title,
  sub,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <div className={`check ${on ? 'on' : ''}`} onClick={onClick}>
      <div className="check-box">
        {on && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5 10 17 19 7.5"/>
          </svg>
        )}
      </div>
      <div className="check-text">
        <span className="check-title">{title}</span>
        <span className="check-sub">{sub}</span>
      </div>
    </div>
  );
}

export default function ShelterTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer) as Shelter;
  const dirty = useSelector((state: RootState) => state.shelters.dirty);
  const saving = useSelector((state: RootState) => state.shelters.saving);
  const photos = useSelector((state: RootState) =>
    s ? (state.photos.byShelter[s.id] ?? []) : [],
  );

  const archList = useSelector((state: RootState) => state.architectures.list);

  if (!s) return null;

  const f =
    <K extends keyof Shelter>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const target = e.target as HTMLInputElement;
      const value =
        target.type === 'checkbox'
          ? target.checked
          : target.type === 'number'
            ? target.value === ''
              ? null
              : +target.value
            : target.value;
      dispatch(setEditBuffer({ ...s, [key]: value }));
    };

  const handleSave = async () => {
    const result = await dispatch(saveShelter(s));
    if (saveShelter.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: 'Record saved · shelters.db' }));
    }
  };

  return (
    <div className="form-wrap">
      {/* Identity */}
      <div className="section-head">
        <span className="section-num">§ 01</span>
        <span className="section-title">Identity <em>& classification</em></span>
        <span className="section-hint">
          Stored in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>shelters.db</code>
        </span>
      </div>

      <div className="field-grid">
        <div className="field col-span-2">
          <label className="label">
            Name <span className="req">*</span>
          </label>
          <input className="input" value={s.name} onChange={f('name')} />
        </div>

        <div className="field">
          <label className="label">
            Slug <span className="hint">URL-safe</span>
          </label>
          <input className="input mono" value={s.slug} onChange={f('slug')} />
        </div>

        <div className="field">
          <label className="label">Category</label>
          <select className="select" value={s.category} onChange={f('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">
            Start year <span className="req">*</span>
          </label>
          <input className="input mono" type="number" value={s.start_year || ''} onChange={f('start_year')} />
        </div>

        <div className="field">
          <label className="label">
            End year <span className="hint">blank if extant</span>
          </label>
          <input
            className="input mono"
            type="number"
            value={s.end_year || ''}
            onChange={f('end_year')}
            placeholder="—"
          />
        </div>

        <div className="field col-span-2">
          <label className="label">
            Description <span className="hint">shown in public catalog</span>
          </label>
          <textarea className="textarea" rows={3} value={s.description || ''} onChange={f('description')} />
        </div>
      </div>

      {/* Provenance */}
      <div className="section-head">
        <span className="section-num">§ 02</span>
        <span className="section-title">Provenance <em>& construction</em></span>
      </div>

      <div className="field-grid">
        <div className="field">
          <label className="label">Architecture</label>
          <select className="select" value={s.architecture} onChange={f('architecture')}>
            {/* Current value not in list: show it as first option so it's not silently dropped */}
            {s.architecture && !archList.some((a) => a.name === s.architecture) && (
              <option value={s.architecture}>{s.architecture}</option>
            )}
            {archList.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Built by</label>
          <input className="input" value={s.built_by || ''} onChange={f('built_by')} />
        </div>

        <div className="field col-span-2">
          <label className="label">
            Internal notes <span className="hint">not published</span>
          </label>
          <textarea className="textarea" rows={2} value={s.notes || ''} onChange={f('notes')} />
        </div>
      </div>

      {/* Flags */}
      <div className="section-head">
        <span className="section-num">§ 03</span>
        <span className="section-title">Flags <em>& visibility</em></span>
      </div>

      <div className="checkbox-grid">
        <FlagCheck
          on={s.is_extant}
          onClick={() => dispatch(setEditBuffer({ ...s, is_extant: !s.is_extant }))}
          title="Is extant"
          sub="Structure still standing"
        />
        <FlagCheck
          on={s.is_gmc}
          onClick={() => dispatch(setEditBuffer({ ...s, is_gmc: !s.is_gmc }))}
          title="GMC stewardship"
          sub="Maintained by club"
        />
        <FlagCheck
          on={s.show_on_web}
          onClick={() => dispatch(setEditBuffer({ ...s, show_on_web: !s.show_on_web }))}
          title="Show on web"
          sub="Publish to public catalog"
        />
      </div>

      {/* System */}
      <div className="section-head" style={{ marginTop: 28 }}>
        <span className="section-num">§ 04</span>
        <span className="section-title">System</span>
        <span className="section-hint">read-only</span>
      </div>

      <div className="field-grid thirds">
        <div className="field">
          <label className="label">Record ID</label>
          <input className="input mono" value={`#${String(s.id).padStart(6, '0')}`} disabled readOnly />
        </div>
        <div className="field">
          <label className="label">Default photo</label>
          <input
            className="input mono"
            value={s.default_photo_id ? `photo_${s.default_photo_id}` : '—'}
            disabled
            readOnly
          />
        </div>
        <div className="field">
          <label className="label">Photo count</label>
          <input className="input mono" value={photos.length || s.photo_count || 0} disabled readOnly />
        </div>
        <div className="field">
          <label className="label">Created</label>
          <input className="input mono" value={s.created} disabled readOnly />
        </div>
        <div className="field">
          <label className="label">Updated</label>
          <input className="input mono" value={s.updated} disabled readOnly />
        </div>
        <div className="field">
          <label className="label">Filesystem path</label>
          <input className="input mono" value={`/shelters/${s.slug}/`} disabled readOnly />
        </div>
      </div>

      <div className="save-bar">
        <div className="save-bar-info">
          {dirty ? (
            <>
              <span className="dot" />
              <span className="changed">Unsaved changes</span>
              <span>
                · will write to{' '}
                <code style={{ fontFamily: 'var(--font-mono)' }}>shelters.db</code>
              </span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5 10 17 19 7.5"/>
              </svg>
              <span>All changes saved · last write {s.updated}</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => dispatch(revertEditBuffer())} disabled={!dirty}>
            Revert
          </button>
          <button className="btn primary" onClick={handleSave} disabled={!dirty || saving}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
            </svg>
            Save record
          </button>
        </div>
      </div>
    </div>
  );
}
