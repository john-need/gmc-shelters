import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AppDispatch, RootState } from '../../../store';
import type { Photo, UntrackedFile, OrphanedRecord, ReconcileApplyResult } from '../../../../shared/ipc-types';
import { uploadPhoto, savePhotoMetadata, updatePhotoLocal, removePhotoLocal, reconcileApply, loadPhotos, reorderPhotos } from '../../../store/photosSlice';
import { setDefaultPhotoLocal } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import { loadStoredPaths } from '../../../pathSettings';
import { buildPhotoUrl } from '../../../utils/paths';
import { reorderByIds } from '../../../utils/reorderByIds';
import { normalizePhotoDateTaken } from '@shared/photo-date';
import PhotoEditorDialog from './PhotoEditorDialog';
import PhotoMetadataDialog from './PhotoMetadataDialog';

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

const noop = () => {};

interface PhotoCardBodyProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  onToggleInclude: (id: number, newValue: boolean) => void;
  photoUrl: string;
}

// Memoised so the image-bearing subtree is skipped on dnd-kit's per-threshold
// re-renders of the sortable wrapper. Props (p, photoUrl, stable callbacks) are
// referentially stable during a drag, so the body never re-renders mid-drag.
const PhotoCardBody = memo(function PhotoCardBody({ p, idx, isDefault, onToggleInclude, photoUrl }: PhotoCardBodyProps) {
  const [imgError, setImgError] = useState(false);
  const initial = p.title ? p.title.charAt(0) : p.file_name.charAt(0).toUpperCase();
  return (
    <>
      <div className="photo-thumb" style={{ background: photoBackground(idx), position: 'relative', overflow: 'hidden' }}>
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
        <div className="photo-meta">
          {isDefault && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--forest)" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              default
            </span>
          )}
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 10 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title="Include in published post"
          >
            <input
              type="checkbox"
              checked={!!p.include_in_post}
              aria-label="Include in post"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onToggleInclude(p.id, e.target.checked)}
              style={{ cursor: 'pointer', margin: 0 }}
            />
            pub
          </label>
        </div>
      </div>
    </>
  );
});

interface PhotoCardProps extends PhotoCardBodyProps {
  isSelected: boolean;
  onSelect: (id: number) => void;
  onOpenEditor: (id: number) => void;
}

const PhotoCard = memo(function PhotoCard({ p, idx, isDefault, isSelected, onSelect, onOpenEditor, onToggleInclude, photoUrl }: PhotoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`photo-card-${p.id}`}
      className={`photo-card ${isSelected ? 'selected' : ''} ${isDefault ? 'default' : ''}`}
      onClick={() => onSelect(p.id)}
      onDoubleClick={() => onOpenEditor(p.id)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <PhotoCardBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={onToggleInclude} photoUrl={photoUrl} />
    </div>
  );
});

function PhotoCardOverlay({ p, idx, isDefault, photoUrl }: PhotoCardBodyProps) {
  return (
    <div
      className={`photo-card ${isDefault ? 'default' : ''}`}
      style={{
        outline: '2px solid var(--forest)',
        outlineOffset: 2,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        cursor: 'grabbing',
      }}
    >
      <PhotoCardBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={noop} photoUrl={photoUrl} />
    </div>
  );
}

const LIST_ROW_GRID = '40px 1.5fr 1fr 110px 80px 90px';

interface ListRowBodyProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  onToggleInclude: (id: number, newValue: boolean) => void;
  photoUrl: string;
}

const ListRowBody = memo(function ListRowBody({ p, idx, isDefault, onToggleInclude, photoUrl }: ListRowBodyProps) {
  const [imgError, setImgError] = useState(false);
  const initial = p.title ? p.title.charAt(0) : p.file_name.charAt(0).toUpperCase();
  return (
    <>
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
      <span
        style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={!!p.include_in_post}
          aria-label="Include in post"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onToggleInclude(p.id, e.target.checked)}
          style={{ cursor: 'pointer', margin: 0 }}
        />
      </span>
    </>
  );
});

interface ListRowProps extends ListRowBodyProps {
  isSelected: boolean;
  onSelect: (id: number) => void;
  onOpenEditor: (id: number) => void;
}

const ListRow = memo(function ListRow({ p, idx, isDefault, isSelected, onSelect, onOpenEditor, onToggleInclude, photoUrl }: ListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`list-row-${p.id}`}
      onClick={() => onSelect(p.id)}
      onDoubleClick={() => onOpenEditor(p.id)}
      style={{
        display: 'grid',
        gridTemplateColumns: LIST_ROW_GRID,
        alignItems: 'center',
        padding: '6px 12px',
        cursor: 'grab',
        borderBottom: '1px solid var(--line)',
        background: isSelected ? 'var(--selected)' : 'transparent',
        fontSize: 12.5,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      {...attributes}
      {...listeners}
    >
      <ListRowBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={onToggleInclude} photoUrl={photoUrl} />
    </div>
  );
});

function ListRowOverlay({ p, idx, isDefault, photoUrl }: ListRowBodyProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: LIST_ROW_GRID,
        alignItems: 'center',
        padding: '6px 12px',
        background: 'var(--surface)',
        fontSize: 12.5,
        outline: '2px solid var(--forest)',
        outlineOffset: -2,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        cursor: 'grabbing',
      }}
    >
      <ListRowBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={noop} photoUrl={photoUrl} />
    </div>
  );
}

interface ReconcileModalProps {
  shelterId: number;
  sheltersRoot: string;
  shelterSlug: string;
  defaultPhotoId: number | null;
  onClose: (applied: boolean) => void;
  dispatch: AppDispatch;
}

function ReconcileModal({ shelterId, sheltersRoot, shelterSlug: _slug, defaultPhotoId, onClose, dispatch }: ReconcileModalProps) {
  const [scanning, setScanning] = useState(true);
  const [untrackedFiles, setUntrackedFiles] = useState<UntrackedFile[]>([]);
  const [orphanedRecords, setOrphanedRecords] = useState<OrphanedRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ReconcileApplyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scan = await window.api.photos.reconcileScan(shelterId, sheltersRoot);
        if (!cancelled) {
          setUntrackedFiles(scan.untrackedFiles);
          setOrphanedRecords(scan.orphanedRecords);
        }
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shelterId, sheltersRoot]);

  const toggleFile = (fileName: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName); else next.add(fileName);
      return next;
    });
  };

  const toggleRecord = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const noneSelected = selectedFiles.size === 0 && selectedIds.size === 0;

  const handleApply = async () => {
    setApplying(true);
    try {
      const action = await dispatch(reconcileApply({
        shelterId,
        sheltersRoot,
        filesToAdd: Array.from(selectedFiles),
        recordIdsToDelete: Array.from(selectedIds),
      }));
      if (reconcileApply.fulfilled.match(action)) {
        const res = action.payload;
        setResult(res);
        selectedIds.forEach((id) => {
          dispatch(removePhotoLocal({ shelterId, photoId: id }));
          if (defaultPhotoId === id) {
            dispatch(setDefaultPhotoLocal({ shelterId, photoId: null, fileName: '' }));
          }
        });
      }
    } finally {
      setApplying(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const dialogStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 8,
    border: '1px solid var(--line-2)',
    padding: '24px 28px', minWidth: 460, maxWidth: 600,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="Reconcile Photos">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18 }}>Reconcile Photos</span>
          <button className="btn icon sm" aria-label="Close" onClick={() => onClose(!!result)}>✕</button>
        </div>

        {scanning ? (
          <p style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>Scanning…</p>
        ) : result ? (
          <div>
            <p style={{ marginBottom: 12, color: 'var(--ink)' }}>
              {result.added > 0 && <span>{result.added} added</span>}
              {result.added > 0 && (result.deleted > 0 || result.failed > 0) && ' · '}
              {result.deleted > 0 && <span>{result.deleted} deleted</span>}
              {result.failed > 0 && (result.added > 0 || result.deleted > 0) && ' · '}
              {result.failed > 0 && <span style={{ color: 'var(--red, #c0392b)' }}>{result.failed} failed</span>}
            </p>
            {result.failures.length > 0 && (
              <ul style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', margin: 0, paddingLeft: 16 }}>
                {result.failures.map((f, i) => <li key={i}>{f.item}: {f.reason}</li>)}
              </ul>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => onClose(true)}>Done</button>
            </div>
          </div>
        ) : (untrackedFiles.length === 0 && orphanedRecords.length === 0) ? (
          <div>
            <p style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>All photos are in sync</p>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => onClose(false)}>Close</button>
            </div>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {untrackedFiles.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
                  Files on disk, not in database ({untrackedFiles.length})
                </p>
                {untrackedFiles.map((f) => {
                  const displayName = f.fileName.split('/').pop() || f.fileName;
                  return (
                    <label key={f.fileName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        aria-label={displayName}
                        checked={selectedFiles.has(f.fileName)}
                        onChange={() => toggleFile(f.fileName)}
                      />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{displayName}</span>
                    </label>
                  );
                })}
              </section>
            )}

            {orphanedRecords.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
                  Database records with no file ({orphanedRecords.length})
                </p>
                {orphanedRecords.map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      aria-label={r.fileName}
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRecord(r.id)}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.fileName}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{r.title}</span>
                  </label>
                ))}
              </section>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button className="btn ghost" onClick={() => onClose(false)}>Cancel</button>
              <button
                className="btn primary"
                disabled={noneSelected || applying}
                onClick={handleApply}
              >
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PhotosTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const photos = useSelector((state: RootState) =>
    s ? (state.photos.byShelter[s.id] ?? []) : [],
  );
  const originals = useSelector((state: RootState) => state.photos.originals);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [repoRoot, setRepoRoot] = useState('');
  const [detailWidth, setDetailWidth] = useState(380);
  const [resizing, setResizing] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheltersRoot = loadStoredPaths().SHELTERS_ROOT;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const photoIds = useMemo(() => photos.map((p) => p.id), [photos]);

  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.api) return undefined;
    window.api.app.getRepoRoot()
      .then((root) => { if (!cancelled) setRepoRoot(root); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (photos.length > 0 && (selectedId === null || !photos.find((p) => p.id === selectedId))) {
      setSelectedId(photos[0].id);
    }
    if (photos.length === 0) setSelectedId(null);
  }, [photos]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = detailWidth;
    setResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (me: MouseEvent) => {
      setDetailWidth(Math.min(600, Math.max(220, startWidth + startX - me.clientX)));
    };
    const onUp = () => {
      setResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (!s) return null;

  const selected = photos.find((p) => p.id === selectedId) ?? null;
  const original = selected ? originals[selected.id] : null;
  const activeDragPhoto = activeDragId !== null ? photos.find((p) => p.id === activeDragId) ?? null : null;

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

  const selectedIdx = photos.findIndex((p) => p.id === selectedId);
  const selectedPhotoUrl = repoRoot && selected
    ? `${buildPhotoUrl(repoRoot, sheltersRoot, selected.file_name)}?v=${version}`
    : '';

  const updatePhoto = (id: number, patch: Partial<Photo>) => {
    dispatch(updatePhotoLocal({ shelterId: s.id, photo: { id, ...patch } }));
  };

  const handleFileSelected = async (file: File) => {
    const filePath = window.api?.app?.getFilePath?.(file) ?? '';
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
      const photo = photos.find((p) => p.id === photoId);
      dispatch(setDefaultPhotoLocal({ shelterId: s.id, photoId, fileName: photo?.file_name ?? '' }));
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Could not set default.' }));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id);
    setActiveDragId(id);
    setSelectedId(id);
  };

  const handleDragCancel = () => setActiveDragId(null);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const fromId = Number(active.id);
    const nextIds = reorderByIds(photos.map((photo) => photo.id), fromId, Number(over.id));
    setSelectedId(fromId);

    dispatch(reorderPhotos({ shelterId: s.id, photoIds: nextIds }))
      .unwrap()
      .catch(() => {
        dispatch(showToast({ id: Date.now().toString(), message: 'Could not save photo order.' }));
      });
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

        const dateTaken = normalizePhotoDateTaken(metadata.date_taken);

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
      dispatch(showToast({ id: Date.now().toString(), message: 'Failed to import metadata.' }));
    }
  };

  const handleToggleInclude = (photoId: number, newValue: boolean) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;
    dispatch(updatePhotoLocal({ shelterId: s.id, photo: { id: photoId, include_in_post: newValue } }));
    dispatch(savePhotoMetadata({
      id: photo.id,
      shelter_id: photo.shelter_id,
      sheltersRoot,
      title: photo.title,
      photographer: photo.photographer,
      caption: photo.caption,
      alt_text: photo.alt_text,
      description: photo.description,
      notes: photo.notes,
      include_in_post: newValue,
      date_taken: photo.date_taken,
      updated: new Date().toISOString().slice(0, 10),
      rotation: 0,
      flipped: false,
      crop: null,
    }));
  };

  const handleSelect = (id: number) => setSelectedId(id);
  const handleOpenEditor = (id: number) => { setSelectedId(id); setEditorOpen(true); };

  const handleReconcileClose = (applied: boolean) => {
    setReconcileOpen(false);
    if (applied) {
      dispatch(loadPhotos(s.id));
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
            <button className="btn sm ghost" onClick={() => setReconcileOpen(true)}>
              Reconcile
            </button>
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
            No photographs in this record&apos;s folder yet.
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={photoIds}
              strategy={view === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
            >
              {view === 'grid' ? (
                <div className="photos-grid">
                  {photos.map((p, i) => (
                    <PhotoCard
                      key={p.id}
                      p={p}
                      idx={i}
                      isDefault={s.default_photo_id === p.id}
                      isSelected={p.id === selectedId}
                      onSelect={handleSelect}
                      onOpenEditor={handleOpenEditor}
                      onToggleInclude={handleToggleInclude}
                      photoUrl={repoRoot ? `${buildPhotoUrl(repoRoot, sheltersRoot, p.file_name)}?v=${version}` : ''}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    display: 'grid', gridTemplateColumns: LIST_ROW_GRID,
                    padding: '8px 12px',
                    fontFamily: 'var(--font-mono)', fontSize: 9.5,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--ink-3)',
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--line)',
                  }}>
                    <span /><span>Title</span><span>Photographer</span><span>Date</span><span>ID</span>
                    <span style={{ textAlign: 'right' }}>Post</span>
                  </div>
                  {photos.map((p, i) => (
                    <ListRow
                      key={p.id}
                      p={p}
                      idx={i}
                      isDefault={s.default_photo_id === p.id}
                      isSelected={p.id === selectedId}
                      onSelect={handleSelect}
                      onOpenEditor={handleOpenEditor}
                      onToggleInclude={handleToggleInclude}
                      photoUrl={repoRoot ? `${buildPhotoUrl(repoRoot, sheltersRoot, p.file_name)}?v=${version}` : ''}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
            <DragOverlay>
              {activeDragPhoto ? (
                view === 'grid' ? (
                  <PhotoCardOverlay
                    p={activeDragPhoto}
                    idx={Math.max(0, photos.findIndex((p) => p.id === activeDragPhoto.id))}
                    isDefault={s.default_photo_id === activeDragPhoto.id}
                    onToggleInclude={() => {}}
                    photoUrl={repoRoot ? `${buildPhotoUrl(repoRoot, sheltersRoot, activeDragPhoto.file_name)}?v=${version}` : ''}
                  />
                ) : (
                  <ListRowOverlay
                    p={activeDragPhoto}
                    idx={Math.max(0, photos.findIndex((p) => p.id === activeDragPhoto.id))}
                    isDefault={s.default_photo_id === activeDragPhoto.id}
                    onToggleInclude={() => {}}
                    photoUrl={repoRoot ? `${buildPhotoUrl(repoRoot, sheltersRoot, activeDragPhoto.file_name)}?v=${version}` : ''}
                  />
                )
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {reconcileOpen && (
        <ReconcileModal
          shelterId={s.id}
          sheltersRoot={sheltersRoot}
          shelterSlug={s.slug}
          defaultPhotoId={s.default_photo_id}
          onClose={handleReconcileClose}
          dispatch={dispatch}
        />
      )}

      {selected && (
        <>
          <div
            className={`photos-resize-handle${resizing ? ' dragging' : ''}`}
            onMouseDown={startResize}
          />
          <div className="photo-detail" style={{ width: detailWidth }}>
          <div className="photo-detail-head">
            <div>
              <div className="photo-detail-title">{selected.title || 'Untitled'}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
                {selected.file_name}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn icon sm" aria-label="View photo metadata" title="View photo metadata" onClick={() => setMetadataOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
              </button>
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

          <div
            data-testid="photo-preview"
            className="photo-preview photo-preview-clickable"
            onClick={() => setEditorOpen(true)}
            style={{ position: 'relative' }}
          >
            <div
              className="photo-preview-frame"
              style={{
                background: photoBackground(selectedIdx),
                position: 'relative', overflow: 'hidden',
              }}
            >
              {selectedPhotoUrl ? (
                <PhotoPreviewImage
                  key={selectedPhotoUrl}
                  src={selectedPhotoUrl}
                  alt={selected.alt_text || selected.title || selected.file_name}
                  fallback={selected.title ? selected.title.charAt(0) : selected.file_name.charAt(0).toUpperCase()}
                />
              ) : (
                <span className="glyph">
                  {selected.title ? selected.title.charAt(0) : selected.file_name.charAt(0).toUpperCase()}
                </span>
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
                <input
                  aria-label="Date taken"
                  className="input mono"
                  type="text"
                  placeholder="YYYY or YYYY-MM-DD"
                  value={selected.date_taken || ''}
                  onChange={(e) => updatePhoto(selected.id, { date_taken: e.target.value })}
                />
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
                title="Copy file metadata values into the editorial record"
                onClick={handleImportMetadata}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>
                </svg>
                {' '}Sync from File
              </button>
            </div>
          </div>
        </div>
        {editorOpen && (
          <PhotoEditorDialog
            photo={selected}
            photoUrl={selectedPhotoUrl}
            shelterId={s.id}
            sheltersRoot={sheltersRoot}
            isDefault={s.default_photo_id === selected.id}
            onSave={() => { setEditorOpen(false); setVersion((v) => v + 1); }}
            onCancel={() => setEditorOpen(false)}
          />
        )}
        {metadataOpen && (
          <PhotoMetadataDialog
            photo={selected}
            shelterId={s.id}
            slug={s.slug}
            sheltersRoot={sheltersRoot}
            onClose={() => setMetadataOpen(false)}
          />
        )}
        </>
      )}
    </div>
  );
}
