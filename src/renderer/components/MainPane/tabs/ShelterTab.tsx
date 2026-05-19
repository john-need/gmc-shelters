import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { setEditBuffer, revertEditBuffer, saveShelter } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import type { Photo, Shelter } from '../../../../shared/ipc-types';

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

function formatYearRange(shelter: Shelter): string {
  return `${shelter.start_year}${shelter.end_year ? `–${shelter.end_year}` : '–present'}`;
}

function formatPhotoDate(photo: Photo | null): string {
  if (!photo?.date_taken) return 'Date unknown';
  return photo.date_taken;
}

function buildPhotoUrl(repoRoot: string, slug: string, fileName: string): string {
  const normalizedRoot = repoRoot.replace(/\\/g, '/').replace(/\/$/, '');
  return encodeURI(`file://${normalizedRoot}/shelters/${slug}/photos/${fileName}`);
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
  const catList = useSelector((state: RootState) => state.categories.list);

  const [repoRoot, setRepoRoot] = useState('');
  const [isPhotoModalOpen, setPhotoModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.api) return undefined;

    window.api.app.getRepoRoot()
      .then((root) => {
        if (!cancelled) setRepoRoot(root);
      })
      .catch(() => {
        if (!cancelled) {
          dispatch(showToast({ id: Date.now().toString(), message: 'Could not load local photo preview.' }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!isPhotoModalOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPhotoModalOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPhotoModalOpen]);

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

  const defaultPhoto = s.default_photo_id
    ? photos.find((photo) => photo.id === s.default_photo_id) ?? null
    : null;
  const defaultPhotoUrl = repoRoot && defaultPhoto
    ? buildPhotoUrl(repoRoot, s.slug, defaultPhoto.file_name)
    : '';
  const photoCount = photos.length || s.photo_count || 0;
  const publishedCount = photos.filter((photo) => photo.include_in_post).length;
  const photoSummary = defaultPhoto
    ? (defaultPhoto.title || defaultPhoto.file_name)
    : 'No default photo selected';
  const photoCaption = defaultPhoto?.caption || defaultPhoto?.description || 'Managed from the Photos tab.';

  return (
    <div className="form-wrap shelter-tab">
      <div className="section-head">
        <span className="section-num">§ 01</span>
        <span className="section-title">Identity <em>& classification</em></span>
        <span className="section-hint">
          Stored in <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>shelters.db</code>
        </span>
      </div>

      <div className="shelter-identity-grid">
        <div className="field-grid shelter-identity-fields">
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
              {s.category && !catList.some((c) => c.name === s.category) && (
                <option value={s.category}>{s.category}</option>
              )}
              {catList.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
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
            <textarea className="textarea" rows={4} value={s.description || ''} onChange={f('description')} />
          </div>
        </div>

        <button
          type="button"
          className={`shelter-media-card shelter-identity-media ${defaultPhoto ? 'has-photo' : ''}`}
          onClick={() => defaultPhoto && setPhotoModalOpen(true)}
          disabled={!defaultPhoto}
          aria-label={defaultPhoto ? 'Open default photo preview' : 'No default photo selected'}
        >
          <div className="shelter-media-frame">
            {defaultPhotoUrl ? (
              <img
                className="shelter-media-image"
                src={defaultPhotoUrl}
                alt={defaultPhoto.alt_text || defaultPhoto.title || `${s.name} default photograph`}
              />
            ) : (
              <div className="shelter-media-placeholder" aria-hidden="true">
                <span>{s.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="shelter-media-overlay">
              <span className="shelter-media-badge">Default photo</span>
              {defaultPhoto && <span className="shelter-media-badge muted">#{defaultPhoto.id}</span>}
            </div>
          </div>
          <div className="shelter-media-meta">
            <div className="shelter-media-meta-row">
              <div>
                <div className="shelter-media-title">{photoSummary}</div>
                <div className="shelter-media-sub">
                  {defaultPhoto
                    ? `${defaultPhoto.photographer || 'Unknown photographer'} · ${formatPhotoDate(defaultPhoto)}`
                    : 'Pick a lead image in the Photos tab to feature it here.'}
                </div>
              </div>
              <div className="shelter-media-side-meta">
                <span className="shelter-media-side-value">{formatYearRange(s)}</span>
                <span className="shelter-media-side-sub">{photoCount} photos · {publishedCount} published</span>
              </div>
            </div>
            <div className="shelter-media-badges-inline">
              <span className="id">#{String(s.id).padStart(6, '0')}</span>
              <span className={`badge ${s.is_extant ? 'extant' : 'gone'}`}>
                {s.is_extant ? 'Extant' : 'Lost'}
              </span>
              {s.is_gmc && <span className="badge gmc">GMC</span>}
              {s.show_on_web && <span className="badge web">Web</span>}
            </div>
            <p className="shelter-media-caption">{photoCaption}</p>
          </div>
        </button>
      </div>

      <div className="section-head">
        <span className="section-num">§ 02</span>
        <span className="section-title">Provenance <em>& records</em></span>
      </div>

      <div className="field-grid">
        <div className="field">
          <label className="label">Architecture</label>
          <select className="select" value={s.architecture} onChange={f('architecture')}>
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
          <textarea className="textarea" rows={3} value={s.notes || ''} onChange={f('notes')} />
        </div>
      </div>

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

      <div className="section-head" style={{ marginTop: 28 }}>
        <span className="section-num">§ 04</span>
        <span className="section-title">System <em>& sync state</em></span>
        <span className="section-hint">read-only</span>
      </div>

      <div className="shelter-system-grid">
        <div className="shelter-system-card">
          <span className="shelter-system-label">Record ID</span>
          <strong>#{String(s.id).padStart(6, '0')}</strong>
        </div>
        <div className="shelter-system-card">
          <span className="shelter-system-label">Default photo</span>
          <strong>{s.default_photo_id ? `photo_${s.default_photo_id}` : '—'}</strong>
        </div>
        <div className="shelter-system-card">
          <span className="shelter-system-label">Photo count</span>
          <strong>{photoCount}</strong>
        </div>
        <div className="shelter-system-card">
          <span className="shelter-system-label">Created</span>
          <strong className="mono">{s.created}</strong>
        </div>
        <div className="shelter-system-card">
          <span className="shelter-system-label">Updated</span>
          <strong className="mono">{s.updated}</strong>
        </div>
        <div className="shelter-system-card">
          <span className="shelter-system-label">Filesystem path</span>
          <strong className="mono">/shelters/{s.slug}/</strong>
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

      {isPhotoModalOpen && defaultPhoto && (
        <div className="shelter-photo-modal-backdrop" onClick={() => setPhotoModalOpen(false)}>
          <div
            className="shelter-photo-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Default photo preview"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="shelter-photo-modal-close"
              onClick={() => setPhotoModalOpen(false)}
              aria-label="Close default photo preview"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>

            <div className="shelter-photo-modal-frame">
              {defaultPhotoUrl ? (
                <img
                  className="shelter-photo-modal-image"
                  src={defaultPhotoUrl}
                  alt={defaultPhoto.alt_text || defaultPhoto.title || `${s.name} default photograph`}
                />
              ) : (
                <div className="shelter-photo-modal-placeholder" aria-hidden="true">
                  <span>{s.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>

            <div className="shelter-photo-modal-meta">
              <div className="shelter-photo-modal-title">{photoSummary}</div>
              <div className="shelter-photo-modal-sub">
                {defaultPhoto.photographer || 'Unknown photographer'} · {formatPhotoDate(defaultPhoto)}
              </div>
              <p>{photoCaption}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
