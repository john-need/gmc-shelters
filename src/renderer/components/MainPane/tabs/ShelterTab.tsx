import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { setEditBuffer, revertEditBuffer, saveShelter } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import { loadStoredPaths } from '../../../pathSettings';
import { buildPhotoUrl } from '../../../utils/paths';
import type { Shelter } from '../../../../shared/ipc-types';

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
  const catList = useSelector((state: RootState) => state.categories.list);

  const [repoRoot, setRepoRoot] = useState('');
  const [isPhotoModalOpen, setPhotoModalOpen] = useState(false);
  const [dppIndex, setDppIndex] = useState(0);
  const [dppImgError, setDppImgError] = useState(false);

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
    setDppImgError(false);
  }, [dppIndex]);

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

  const handleOpenDpp = () => {
    const idx = photos.findIndex((p) => p.id === s.default_photo_id);
    setDppIndex(idx >= 0 ? idx : 0);
    setDppImgError(false);
    setPhotoModalOpen(true);
  };

  const handleSetDefault = async (photoId: number) => {
    try {
      if (typeof window !== 'undefined' && window.api) {
        await window.api.photos.setDefault(s.id, photoId);
      }
      dispatch(setEditBuffer({ ...s, default_photo_id: photoId }));
      dispatch(showToast({ id: Date.now().toString(), message: 'Default photo updated.' }));
      setPhotoModalOpen(false);
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Could not set default.' }));
    }
  };

  const dppBackground = (idx: number) => {
    const grads = [
      'linear-gradient(135deg, #c9a36b 0%, #8a5b32 100%)',
      'linear-gradient(135deg, #8a9e9d 0%, #4f6464 100%)',
      'linear-gradient(135deg, #a89b80 0%, #6a5d44 100%)',
    ];
    return `repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 14px), ${grads[idx % 3]}`;
  };

  const defaultPhoto = s.default_photo_id
    ? photos.find((photo) => photo.id === s.default_photo_id) ?? null
    : null;

  const sheltersRoot = loadStoredPaths().SHELTERS_ROOT;
  const defaultPhotoUrl = repoRoot && defaultPhoto
    ? buildPhotoUrl(repoRoot, sheltersRoot, defaultPhoto.file_name)
    : '';
  const photoCount = photos.length || s.photo_count || 0;
  const photoSummary = defaultPhoto ? (defaultPhoto.title || defaultPhoto.file_name) : 'No default photo selected';

  const dppPhoto = photos.length > 0 ? photos[dppIndex] : null;
  const dppPhotoUrl = repoRoot && dppPhoto
    ? buildPhotoUrl(repoRoot, sheltersRoot, dppPhoto.file_name)
    : '';

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
          onClick={handleOpenDpp}
          disabled={photos.length === 0}
          aria-label={photos.length > 0 ? 'Choose default photo' : 'No photographs available'}
        >
          <div className="shelter-media-frame">
            {defaultPhotoUrl ? (
              <img
                className="shelter-media-image"
                src={defaultPhotoUrl}
                alt={defaultPhoto?.alt_text || defaultPhoto?.title || `${s.name} default photograph`}
              />
            ) : (
              <div className="shelter-media-placeholder" aria-hidden="true">
                <span>{s.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            {defaultPhoto && (
              <div className="shelter-media-overlay">
                <span className="shelter-media-badge">Default photo</span>
              </div>
            )}
          </div>
          <div className="shelter-media-meta">
            <div className="shelter-media-title">{photoSummary}</div>
            <div className="shelter-media-sub">
              {defaultPhoto
                ? `Photo ID ${defaultPhoto.id}`
                : photos.length > 0
                  ? `${photos.length} photo${photos.length !== 1 ? 's' : ''} available — click to choose default`
                  : 'Pick a lead image in the Photos tab to feature it here.'}
            </div>
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

      {isPhotoModalOpen && photos.length > 0 && (
        <div className="modal-bg" onClick={() => setPhotoModalOpen(false)}>
          <div
            className="modal wide"
            role="dialog"
            aria-modal="true"
            aria-label="Choose Default Photo"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Choose default <em>photo</em></h2>
              <div className="sub">{s.name} · {photos.length} photograph{photos.length !== 1 ? 's' : ''}</div>
            </div>

            <div className="dpp-body">
              <button
                type="button"
                className="dpp-nav"
                aria-label="Previous photo"
                disabled={photos.length <= 1}
                onClick={() => setDppIndex((i) => (i - 1 + photos.length) % photos.length)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>

              <div className="dpp-stage">
                <div className="dpp-frame" style={{ background: dppBackground(dppIndex) }}>
                  {dppPhotoUrl && !dppImgError ? (
                    <img
                      key={dppPhotoUrl}
                      src={dppPhotoUrl}
                      alt={dppPhoto?.alt_text || dppPhoto?.title || s.name}
                      onError={() => setDppImgError(true)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <span className="dpp-glyph">{s.name.charAt(0).toUpperCase()}</span>
                  )}
                  {dppPhoto && s.default_photo_id === dppPhoto.id && (
                    <div className="dpp-current-badge">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Current default
                    </div>
                  )}
                  <div className="dpp-counter">{dppIndex + 1} / {photos.length}</div>
                </div>

                {dppPhoto && (
                  <div className="dpp-meta">
                    <div className="dpp-title">{dppPhoto.title || 'Untitled'}</div>
                    <div className="dpp-sub">
                      {dppPhoto.photographer && <span><strong>By</strong>{dppPhoto.photographer}</span>}
                      {dppPhoto.date_taken && <span><strong>Date</strong>{dppPhoto.date_taken}</span>}
                      <span><strong>ID</strong>photo_{dppPhoto.id}</span>
                    </div>
                    {dppPhoto.caption && <div className="dpp-caption">{dppPhoto.caption}</div>}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="dpp-nav"
                aria-label="Next photo"
                disabled={photos.length <= 1}
                onClick={() => setDppIndex((i) => (i + 1) % photos.length)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            <div className="dpp-strip">
              {photos.map((p, i) => {
                const thumbUrl = repoRoot ? buildPhotoUrl(repoRoot, sheltersRoot, p.file_name) : '';
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`dpp-thumb ${i === dppIndex ? 'active' : ''}`}
                    onClick={() => setDppIndex(i)}
                    aria-label={p.title || p.file_name}
                    style={{ background: dppBackground(i) }}
                  >
                    {thumbUrl && (
                      <img
                        src={thumbUrl}
                        alt=""
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                    {s.default_photo_id === p.id && (
                      <div className="dpp-thumb-star">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="none">
                          <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="modal-foot">
              <button type="button" className="btn" onClick={() => setPhotoModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="btn primary"
                disabled={!dppPhoto || s.default_photo_id === dppPhoto.id}
                onClick={() => dppPhoto && handleSetDefault(dppPhoto.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {' '}Set as Default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
