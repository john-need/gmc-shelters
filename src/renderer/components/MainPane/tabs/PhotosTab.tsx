import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { Photo } from '../../../../shared/ipc-types';
import { uploadPhoto, savePhotoMetadata, updatePhotoLocal, removePhotoLocal } from '../../../store/photosSlice';
import { setEditBuffer } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import { loadStoredPaths } from '../../../pathSettings';
import { buildPhotoUrl } from '../../../utils/paths';

function PhotoPreviewImage({ src, alt, fallback, onLoad }: { src: string; alt: string; fallback: string; onLoad?: (img: HTMLImageElement) => void }) {
  const [imgError, setImgError] = useState(false);
  return imgError ? (
    <span className="glyph">{fallback}</span>
  ) : (
    <img
      src={src}
      alt={alt}
      onLoad={(e) => onLoad?.(e.currentTarget)}
      onError={() => setImgError(true)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

const TONE_GRADS: Record<string, string> = {
  warm: 'linear-gradient(135deg, #c9a36b 0%, #8a5b32 100%)',
  cool: 'linear-gradient(135deg, #8a9e9d 0%, #4f6464 100%)',
  neutral: 'linear-gradient(135deg, #a89b80 0%, #6a5d44 100%)',
};

function photoBackground(idx: number) {
  const tones = ['warm', 'cool', 'neutral'];
  const tone = tones[idx % 3];
  const grad = TONE_GRADS[tone];
  return `repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 14px), ${grad}`;
}

interface PhotoCardProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  isSelected: boolean;
  onClick: () => void;
  photoUrl: string;
}

function PhotoCard({ p, idx, isDefault, isSelected, onClick, photoUrl }: PhotoCardProps) {
  const [imgError, setImgError] = useState(false);
  const initial = p.title ? p.title.charAt(0) : p.file_name.charAt(0).toUpperCase();
  return (
    <div className={`photo-card ${isSelected ? 'selected' : ''} ${isDefault ? 'default' : ''}`} onClick={onClick}>
      <div className="photo-thumb" style={{ background: photoBackground(idx), position: 'relative', overflow: 'hidden' }}>
        <div className="photo-badges">
          {isDefault && <span className="photo-badge default">★ Default</span>}
          {p.include_in_post && <span className="photo-badge published">Published</span>}
        </div>
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={p.alt_text || p.title || p.file_name}
            onError={() => setImgError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span className="placeholder-glyph" style={{ color: 'rgba(255,247,225,0.7)' }}>{initial}</span>
        )}
      </div>
      <div className="photo-info">
        <span className="photo-title">{p.title || 'Untitled'}</span>
        <span className="photo-meta">
          {p.date_taken || '—'} · {p.photographer || 'Unknown'}
        </span>
      </div>
    </div>
  );
}

interface ListRowProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  isSelected: boolean;
  onSelect: () => void;
  photoUrl: string;
}

function ListRow({ p, idx, isDefault, isSelected, onSelect, photoUrl }: ListRowProps) {
  const [imgError, setImgError] = useState(false);
  const initial = p.title ? p.title.charAt(0) : p.file_name.charAt(0).toUpperCase();
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1.5fr 1fr 110px 80px 90px',
        alignItems: 'center',
        padding: '6px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--line)',
        background: isSelected ? 'var(--selected)' : 'transparent',
        fontSize: 12.5,
      }}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 3,
        background: photoBackground(idx),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
        color: 'rgba(255,247,225,0.7)',
        position: 'relative', overflow: 'hidden',
      }}>
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt=""
            onError={() => setImgError(true)}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : initial}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {isDefault && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--forest)" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        )}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled'}</span>
      </div>
      <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{p.photographer || '—'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{p.date_taken || '—'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>#{p.id}</span>
      <span style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
        {p.include_in_post ? 'PUB' : '—'}
      </span>
    </div>
  );
}

export default function PhotosTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const photos = useSelector((state: RootState) =>
    s ? (state.photos.byShelter[s.id] ?? []) : [],
  );
  const uploading = useSelector((state: RootState) => state.photos.uploading);
  const originals = useSelector((state: RootState) => state.photos.originals);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [flipped, setFlipped] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cropRect, setCropRect] = useState({ x: 12, y: 14, w: 70, h: 68 });
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);
  const [version, setVersion] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [repoRoot, setRepoRoot] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  const sheltersRoot = loadStoredPaths().SHELTERS_ROOT;

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.api) return undefined;
    window.api.app.getRepoRoot()
      .then((root) => { if (!cancelled) setRepoRoot(root); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setRotation(0); setZoom(1); setFlipped(false); setCropping(false); setCrop(null);
    setNaturalSize(null); setFrameSize(null); setCropRect({ x: 12, y: 14, w: 70, h: 68 });
  }, [selectedId]);

  useEffect(() => {
    if (photos.length > 0 && (selectedId === null || !photos.find((p) => p.id === selectedId))) {
      setSelectedId(photos[0].id);
    }
    if (photos.length === 0) setSelectedId(null);
  }, [photos]);

  const renderedImageRect = naturalSize && frameSize ? (() => {
    const scale = Math.min(frameSize.w / naturalSize.w, frameSize.h / naturalSize.h);
    const iw = naturalSize.w * scale;
    const ih = naturalSize.h * scale;
    return { left: (frameSize.w - iw) / 2, top: (frameSize.h - ih) / 2, width: iw, height: ih };
  })() : null;

  const startCropDrag = useCallback((
    type: 'move' | 'tl' | 'tr' | 'bl' | 'br',
    e: React.MouseEvent<HTMLElement>,
  ) => {
    e.stopPropagation();
    const overlay = cropOverlayRef.current;
    if (!overlay) return;
    const r = overlay.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...cropRect };
    const MIN = 5;

    const onMove = (me: MouseEvent) => {
      const dx = ((me.clientX - startX) / r.width) * 100;
      const dy = ((me.clientY - startY) / r.height) * 100;
      let { x, y, w, h } = startRect;
      if (type === 'move') {
        x = Math.max(0, Math.min(100 - startRect.w, startRect.x + dx));
        y = Math.max(0, Math.min(100 - startRect.h, startRect.y + dy));
      } else if (type === 'tl') {
        const nx = Math.max(0, Math.min(startRect.x + startRect.w - MIN, startRect.x + dx));
        const ny = Math.max(0, Math.min(startRect.y + startRect.h - MIN, startRect.y + dy));
        w = startRect.w - (nx - startRect.x); h = startRect.h - (ny - startRect.y); x = nx; y = ny;
      } else if (type === 'tr') {
        const ny = Math.max(0, Math.min(startRect.y + startRect.h - MIN, startRect.y + dy));
        h = startRect.h - (ny - startRect.y); y = ny;
        w = Math.max(MIN, Math.min(100 - startRect.x, startRect.w + dx));
      } else if (type === 'bl') {
        const nx = Math.max(0, Math.min(startRect.x + startRect.w - MIN, startRect.x + dx));
        w = startRect.w - (nx - startRect.x); x = nx;
        h = Math.max(MIN, Math.min(100 - startRect.y, startRect.h + dy));
      } else {
        w = Math.max(MIN, Math.min(100 - startRect.x, startRect.w + dx));
        h = Math.max(MIN, Math.min(100 - startRect.y, startRect.h + dy));
      }
      setCropRect({ x, y, w, h });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [cropRect]);

  if (!s) return null;

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const original = selected ? originals[selected.id] : null;

  const isMetadataDirty = !!(selected && original && (
    (selected.title || '') !== (original.title || '') ||
    (selected.photographer || '') !== (original.photographer || '') ||
    (selected.date_taken || '') !== (original.date_taken || '') ||
    (selected.caption || '') !== (original.caption || '') ||
    (selected.alt_text || '') !== (original.alt_text || '') ||
    (selected.description || '') !== (original.description || '') ||
    (selected.notes || '') !== (original.notes || '') ||
    selected.include_in_post !== original.include_in_post
  ));

  const isEditDirty = rotation !== 0 || flipped !== false || crop !== null;

  const cropPreviewStyle: React.CSSProperties | null = (crop && !cropping && naturalSize && frameSize) ? (() => {
    const { w: fw, h: fh } = frameSize;
    const fitScale = Math.min(fw / crop.width, fh / crop.height);
    const totalW = naturalSize.w * fitScale;
    const totalH = naturalSize.h * fitScale;
    const left = (fw - crop.width * fitScale) / 2 - crop.x * fitScale;
    const top = (fh - crop.height * fitScale) / 2 - crop.y * fitScale;
    return { position: 'absolute' as const, left, top, width: totalW, height: totalH };
  })() : null;

  const selectedIdx = photos.findIndex((p) => p.id === selectedId);
  const selectedPhotoUrl = repoRoot && selected
    ? `${buildPhotoUrl(repoRoot, sheltersRoot, selected.file_name)}?v=${version}`
    : '';

  const updatePhoto = (id: number, patch: Partial<Photo>) => {
    dispatch(updatePhotoLocal({ shelterId: s.id, photo: { id, ...patch } }));
  };

  const handleFileSelected = async (file: File) => {
    const filePath = (file as File & { path?: string }).path;
    if (!filePath) {
      dispatch(showToast({ id: Date.now().toString(), message: 'Could not get file path.' }));
      return;
    }
    try {
      const result = await dispatch(uploadPhoto({
        shelterId: s.id,
        sourcePath: filePath,
        sheltersRoot,
        title: file.name.replace(/\.[^.]+$/, ''),
      }));
      if (uploadPhoto.fulfilled.match(result)) {
        setSelectedId(result.payload.photo.id);
        dispatch(showToast({ id: Date.now().toString(), message: `Uploaded · ${file.name}` }));
      }
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Upload failed.' }));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelected(file);
  };

  const handleDeletePhoto = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this photograph? This will also remove the file from your computer.')) return;
    try {
      if (typeof window !== 'undefined' && window.api) {
        await window.api.photos.delete(id, sheltersRoot);
      }
      dispatch(removePhotoLocal({ shelterId: s.id, photoId: id }));
      dispatch(showToast({ id: Date.now().toString(), message: 'Photo deleted from database and disk.' }));
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Delete failed.' }));
    }
  };

  const handleSetDefault = async (photoId: number) => {
    try {
      if (typeof window !== 'undefined' && window.api) {
        await window.api.photos.setDefault(s.id, photoId);
      }
      dispatch(setEditBuffer({ ...s, default_photo_id: photoId }));
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Could not set default.' }));
    }
  };

  const handleSaveEdits = async () => {
    if (!selected) return;
    const result = await dispatch(savePhotoMetadata({
      id: selected.id,
      shelter_id: selected.shelter_id,
      sheltersRoot,
      title: selected.title,
      photographer: selected.photographer,
      caption: selected.caption,
      alt_text: selected.alt_text,
      description: selected.description,
      notes: selected.notes,
      include_in_post: selected.include_in_post,
      date_taken: selected.date_taken,
      updated: new Date().toISOString().slice(0, 10),
      rotation: rotation % 360,
      flipped,
      crop,
    }));
    if (savePhotoMetadata.fulfilled.match(result)) {
      setRotation(0);
      setFlipped(false);
      setCrop(null);
      setCropping(false);
      setVersion((v) => v + 1);
      dispatch(showToast({ id: Date.now().toString(), message: 'Photo saved.' }));
    }
  };

  const handleSaveMetadata = async () => {
    if (!selected) return;
    const result = await dispatch(savePhotoMetadata({
      id: selected.id,
      shelter_id: selected.shelter_id,
      sheltersRoot,
      title: selected.title,
      photographer: selected.photographer,
      caption: selected.caption,
      alt_text: selected.alt_text,
      description: selected.description,
      notes: selected.notes,
      include_in_post: selected.include_in_post,
      date_taken: selected.date_taken,
      updated: new Date().toISOString().slice(0, 10),
      rotation: 0,
      flipped: false,
      crop: null,
    }));
    if (savePhotoMetadata.fulfilled.match(result)) {
      dispatch(showToast({ id: Date.now().toString(), message: 'Metadata saved.' }));
    }
  };

  const handleImportMetadata = async () => {
    if (!selected || !s) return;
    try {
      if (typeof window !== 'undefined' && window.api) {
        const metadata = await window.api.photos.readMetadata(s.slug, selected.file_name, sheltersRoot);

        let dateTaken = metadata.date_taken || '';
        // Convert "YYYY:MM:DD HH:MM:SS" (exif) to "YYYY-MM-DD" (HTML5 date)
        if (dateTaken.match(/^\d{4}:\d{2}:\d{2}/)) {
          dateTaken = dateTaken.substring(0, 10).replace(/:/g, '-');
        }

        dispatch(updatePhotoLocal({
          shelterId: s.id,
          photo: {
            id: selected.id,
            ...metadata,
            date_taken: dateTaken,
          },
        }));
        dispatch(showToast({ id: Date.now().toString(), message: 'Metadata imported from file.' }));
      }
    } catch (err) {
      console.error('Import failed', err);
      dispatch(showToast({ id: Date.now().toString(), message: 'Failed to import metadata.', type: 'error' }));
    }
  };

  return (
    <div className="photos-wrap">
      <div className="photos-list">
        <div className="photos-toolbar">
          <div className="photos-toolbar-left">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
            </svg>
            <span>{photos.length} photographs · {photos.filter((p) => p.include_in_post).length} published</span>
          </div>
          <div className="photos-toolbar-right">
            <button className={`btn sm ${view === 'grid' ? '' : 'ghost'}`} onClick={() => setView('grid')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              {' '}Grid
            </button>
            <button className={`btn sm ${view === 'list' ? '' : 'ghost'}`} onClick={() => setView('list')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              {' '}List
            </button>
            <button className="btn sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
              </svg>
              {' '}{uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/tiff,image/webp"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        <div
          className={`upload-zone ${dragOver ? 'drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 42, height: 42, borderRadius: 6,
              background: 'var(--surface-2)', border: '1px solid var(--line-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--ink-2)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="upload-zone-text">
              <span className="upload-title">Drop photographs here</span>
              <span className="upload-sub">
                JPEG, PNG, TIFF · stored in{' '}
                <code style={{ fontFamily: 'var(--font-mono)' }}>/shelters/{s.slug}/photos/</code>
              </span>
            </div>
          </div>
          <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
            Browse files
          </button>
        </div>

        {photos.length === 0 ? (
          <div style={{
            padding: '60px 20px', textAlign: 'center',
            border: '1px dashed var(--line-2)', borderRadius: 8,
            color: 'var(--ink-3)', fontFamily: 'var(--font-display)',
            fontStyle: 'italic', fontSize: 16,
          }}>
            No photographs in this record's folder yet.
          </div>
        ) : view === 'grid' ? (
          <div className="photos-grid">
            {photos.map((p, i) => (
              <PhotoCard
                key={p.id}
                p={p}
                idx={i}
                isDefault={s.default_photo_id === p.id}
                isSelected={p.id === selectedId}
                onClick={() => setSelectedId(p.id)}
                photoUrl={repoRoot ? buildPhotoUrl(repoRoot, sheltersRoot, p.file_name) : ''}
              />
            ))}
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '40px 1.5fr 1fr 110px 80px 90px',
              padding: '8px 12px',
              fontFamily: 'var(--font-mono)', fontSize: 9.5,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--ink-3)',
              background: 'var(--surface-2)',
              borderBottom: '1px solid var(--line)',
            }}>
              <span /><span>Title</span><span>Photographer</span><span>Date</span><span>ID</span>
              <span style={{ textAlign: 'right' }}>Flags</span>
            </div>
            {photos.map((p, i) => (
              <ListRow
                key={p.id}
                p={p}
                idx={i}
                isDefault={s.default_photo_id === p.id}
                isSelected={p.id === selectedId}
                onSelect={() => setSelectedId(p.id)}
                photoUrl={repoRoot ? buildPhotoUrl(repoRoot, sheltersRoot, p.file_name) : ''}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="photo-detail">
          <div className="photo-detail-head">
            <div>
              <div className="photo-detail-title">{selected.title || 'Untitled'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
                {selected.file_name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn icon sm" title="Set as default photo" onClick={() => handleSetDefault(selected.id)}>
                {s.default_photo_id === selected.id ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--forest)" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                )}
              </button>
              <button className="btn icon sm" title="Delete photo" onClick={() => handleDeletePhoto(selected.id)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="photo-preview">
            <div
              ref={frameRef}
              className="photo-preview-frame"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom}) scaleX(${flipped ? -1 : 1})`,
                background: photoBackground(selectedIdx),
                position: 'relative', overflow: cropping ? 'visible' : 'hidden',
              }}
            >
              {selectedPhotoUrl ? (
                cropPreviewStyle ? (
                  <img
                    key={`${selectedPhotoUrl}-crop`}
                    src={selectedPhotoUrl}
                    alt={selected.alt_text || selected.title || selected.file_name}
                    style={cropPreviewStyle}
                  />
                ) : (
                  <PhotoPreviewImage
                    key={selectedPhotoUrl}
                    src={selectedPhotoUrl}
                    alt={selected.alt_text || selected.title || selected.file_name}
                    fallback={selected.title ? selected.title.charAt(0) : selected.file_name.charAt(0).toUpperCase()}
                    onLoad={(img) => {
                      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                      if (frameRef.current) {
                        const fr = frameRef.current.getBoundingClientRect();
                        setFrameSize({ w: fr.width, h: fr.height });
                      }
                    }}
                  />
                )
              ) : (
                <span className="glyph">
                  {selected.title ? selected.title.charAt(0) : selected.file_name.charAt(0).toUpperCase()}
                </span>
              )}
            {cropping && renderedImageRect && (
              <div
                ref={cropOverlayRef}
                style={{
                  position: 'absolute',
                  left: renderedImageRect.left,
                  top: renderedImageRect.top,
                  width: renderedImageRect.width,
                  height: renderedImageRect.height,
                }}
              >
                <div
                  className="crop-rect"
                  style={{
                    position: 'absolute',
                    left: `${cropRect.x}%`,
                    top: `${cropRect.y}%`,
                    width: `${cropRect.w}%`,
                    height: `${cropRect.h}%`,
                    cursor: 'move',
                  }}
                  onMouseDown={(e) => startCropDrag('move', e)}
                >
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <div
                      key={c}
                      className="crop-handle"
                      style={{
                        position: 'absolute',
                        [c.includes('t') ? 'top' : 'bottom']: -5,
                        [c.includes('l') ? 'left' : 'right']: -5,
                        cursor: c === 'tl' || c === 'br' ? 'nwse-resize' : 'nesw-resize',
                      }}
                      onMouseDown={(e) => startCropDrag(c, e)}
                    />
                  ))}
                </div>
              </div>
            )}
            </div>
            {s.default_photo_id === selected.id && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'var(--forest)', color: 'var(--surface)',
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 2,
              }}>★ Default</div>
            )}
          </div>

          <div className="photo-tools">
            <div className="group">
              <button className="btn icon sm" title="Rotate 90° left" onClick={() => setRotation((r) => r - 90)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9c-2.5 0-4.8 1-6.5 2.6L3 8"/><path d="M3 3v5h5"/>
                </svg>
              </button>
              <button className="btn icon sm" title="Rotate 90° right" onClick={() => setRotation((r) => r + 90)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.6L21 8"/><path d="M21 3v5h-5"/>
                </svg>
              </button>
              <button className="btn icon sm" title="Flip horizontal" onClick={() => setFlipped((x) => !x)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v18"/><path d="M16 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3"/><path d="M8 7H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
            </div>
            <div className="group">
              <button className={`btn sm ${cropping ? 'primary' : ''}`} onClick={() => {
                if (cropping) {
                  if (naturalSize) {
                    setCrop({
                      x: Math.round(naturalSize.w * cropRect.x / 100),
                      y: Math.round(naturalSize.h * cropRect.y / 100),
                      width: Math.round(naturalSize.w * cropRect.w / 100),
                      height: Math.round(naturalSize.h * cropRect.h / 100),
                    });
                  }
                  setCropping(false);
                } else {
                  setCropRect({ x: 12, y: 14, w: 70, h: 68 });
                  setCrop(null);
                  setCropping(true);
                }
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>
                </svg>
                {' '}{cropping ? 'Done' : 'Crop'}
              </button>
              <button
                className={`btn sm ${isEditDirty ? 'primary' : ''}`}
                disabled={!isEditDirty || cropping}
                onClick={handleSaveEdits}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
                </svg>
                {' '}Save
              </button>
            </div>
            <div className="group" style={{ marginLeft: 'auto' }}>
              <button className="btn icon sm" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>−</button>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: 'var(--ink-3)', padding: '0 6px',
                display: 'flex', alignItems: 'center', minWidth: 36, justifyContent: 'center',
              }}>{Math.round(zoom * 100)}%</span>
              <button className="btn icon sm" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>+</button>
            </div>
          </div>

          <div className="photo-fields">
            <div className="field">
              <label className="label">Title</label>
              <input className="input" value={selected.title || ''} onChange={(e) => updatePhoto(selected.id, { title: e.target.value })} />
            </div>

            <div className="row-2">
              <div className="field">
                <label className="label">Photographer</label>
                <input className="input" value={selected.photographer || ''} onChange={(e) => updatePhoto(selected.id, { photographer: e.target.value })} />
              </div>
              <div className="field">
                <label className="label">Date taken</label>
                <input className="input mono" type="date" value={selected.date_taken || ''} onChange={(e) => updatePhoto(selected.id, { date_taken: e.target.value })} />
              </div>
            </div>

            <div className="field">
              <label className="label">Caption <span className="hint">public</span></label>
              <textarea className="textarea" rows={2} value={selected.caption || ''} onChange={(e) => updatePhoto(selected.id, { caption: e.target.value })} />
            </div>

            <div className="field">
              <label className="label">Alt text <span className="hint">accessibility</span></label>
              <textarea className="textarea" rows={2} value={selected.alt_text || ''} onChange={(e) => updatePhoto(selected.id, { alt_text: e.target.value })} />
            </div>

            <div className="field">
              <label className="label">Description</label>
              <textarea className="textarea" rows={2} value={selected.description || ''} onChange={(e) => updatePhoto(selected.id, { description: e.target.value })} />
            </div>

            <div className="field">
              <label className="label">Internal notes</label>
              <textarea className="textarea" rows={2} value={selected.notes || ''} onChange={(e) => updatePhoto(selected.id, { notes: e.target.value })} />
            </div>

            <div
              className={`check ${selected.include_in_post ? 'on' : ''}`}
              onClick={() => updatePhoto(selected.id, { include_in_post: !selected.include_in_post })}
            >
              <div className="check-box">
                {selected.include_in_post && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5 10 17 19 7.5"/>
                  </svg>
                )}
              </div>
              <div className="check-text">
                <span className="check-title">Include in published post</span>
                <span className="check-sub">Appears in the public shelter page</span>
              </div>
            </div>

            <div style={{
              marginTop: 4, padding: '8px 10px',
              background: 'var(--surface-2)', borderRadius: 5,
              border: '1px solid var(--line)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--ink-3)', letterSpacing: '0.04em',
              display: 'flex', justifyContent: 'space-between',
            }}>
              <span>photo_id: {selected.id}</span>
              <span>shelter_id: {s.id}</span>
            </div>

            <div className="row-2" style={{ marginTop: 8 }}>
              <button
                className={`btn ${isMetadataDirty ? 'primary' : ''}`}
                onClick={handleSaveMetadata}
                disabled={!isMetadataDirty}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
                </svg>
                {' '}Save Metadata
              </button>
              <button
                className="btn ghost sm"
                title="Import from File"
                onClick={handleImportMetadata}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>
                </svg>
                {' '}Import from File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
