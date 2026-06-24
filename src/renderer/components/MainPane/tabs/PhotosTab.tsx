import { useState, useEffect, useRef, useMemo } from 'react';
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
  rectSortingStrategy,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { AppDispatch, RootState } from '../../../store';
import type { Photo } from '../../../../shared/ipc-types';
import { uploadPhoto, savePhotoMetadata, updatePhotoLocal, removePhotoLocal, loadPhotos, reorderPhotos } from '../../../store/photosSlice';
import { setDefaultPhotoLocal } from '../../../store/sheltersSlice';
import { showToast } from '../../../store/uiSlice';
import { loadStoredPaths } from '../../../pathSettings';
import { buildPhotoUrl } from '../../../utils/paths';
import { reorderByIds } from '../../../utils/reorderByIds';
import { normalizePhotoDateTaken } from '@shared/photo-date';
import { useRepoRoot } from '../../../hooks/useRepoRoot';
import { PhotoCard, PhotoCardOverlay, type PhotoCardProps } from './PhotoCard';
import { ListRow, ListRowOverlay, LIST_ROW_GRID, LIST_ROW_PAD } from './ListRow';
import ConfirmDialog from './ConfirmDialog';
import ReconcileModal from './ReconcileModal';
import PhotoDetailPane from './PhotoDetailPane';
import MovePhotoDialog from './MovePhotoDialog';

function photoItemProps(
  p: Photo,
  i: number,
  defaultPhotoId: number | null,
  selectedId: number | null,
  handlers: Pick<PhotoCardProps, 'onSelect' | 'onOpenEditor' | 'onToggleInclude'>,
  repoRoot: string,
  sheltersRoot: string,
  version: number,
): PhotoCardProps {
  return {
    p,
    idx: i,
    isDefault: defaultPhotoId === p.id,
    isSelected: p.id === selectedId,
    photoUrl: repoRoot ? `${buildPhotoUrl(repoRoot, sheltersRoot, p.file_name, 'grid')}&v=${version}` : '',
    ...handlers,
  };
}

export default function PhotosTab() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const photos = useSelector((state: RootState) =>
    s ? (state.photos.byShelter[s.id] ?? []) : [],
  );
  const originals = useSelector((state: RootState) => state.photos.originals);
  const allShelters = useSelector((state: RootState) => state.shelters.list);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [detailWidth, setDetailWidth] = useState(380);
  const [resizing, setResizing] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingMoveId, setPendingMoveId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sheltersRoot = loadStoredPaths().SHELTERS_ROOT;
  const repoRoot = useRepoRoot();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const photoIds = useMemo(() => photos.map((p) => p.id), [photos]);

  useEffect(() => {
    if (photos.length > 0 && (selectedId === null || !photos.find((p) => p.id === selectedId))) {
      setSelectedId(photos[0].id);
    }
    if (photos.length === 0) setSelectedId(null);
  }, [photos, selectedId]);

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
    ? `${buildPhotoUrl(repoRoot, sheltersRoot, selected.file_name, 'preview')}&v=${version}`
    : '';
  // Editor needs the true full-resolution original, not the preview thumbnail (FR-005).
  const editorPhotoUrl = repoRoot && selected
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
      const result = await dispatch(uploadPhoto({ shelterId: s.id, sourcePath: filePath, sheltersRoot, title: file.name.replace(/\.[^.]+$/, '') }));
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
    setPendingDeleteId(null);
    try {
      if (typeof window !== 'undefined' && window.api) {
        await window.api.photos.delete(id, sheltersRoot);
      }
      dispatch(removePhotoLocal({ shelterId: s.id, photoId: id }));
      if (s.default_photo_id === id) {
        dispatch(setDefaultPhotoLocal({ shelterId: s.id, photoId: null, fileName: '' }));
      }
      dispatch(showToast({ id: Date.now().toString(), message: 'Photo deleted.' }));
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Delete failed.' }));
    }
  };

  const handleMovePhoto = async (id: number, targetShelterId: number) => {
    setPendingMoveId(null);
    try {
      if (typeof window !== 'undefined' && window.api) {
        await window.api.photos.move(id, targetShelterId, sheltersRoot);
      }
      dispatch(removePhotoLocal({ shelterId: s.id, photoId: id }));
      if (s.default_photo_id === id) {
        dispatch(setDefaultPhotoLocal({ shelterId: s.id, photoId: null, fileName: '' }));
      }
      dispatch(showToast({ id: Date.now().toString(), message: 'Photo moved.' }));
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Move failed.' }));
    }
  };

  const handleExportPhoto = async () => {
    if (!selected || !s) return;
    try {
      if (typeof window !== 'undefined' && window.api) {
        const savedPath = await window.api.photos.export(s.slug, selected.file_name, selected.title || '', sheltersRoot);
        if (savedPath) dispatch(showToast({ id: Date.now().toString(), message: 'Photo exported.' }));
      }
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Export failed.' }));
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
      .catch(() => { dispatch(showToast({ id: Date.now().toString(), message: 'Could not save photo order.' })); });
  };

  const handleSaveMetadata = async () => {
    if (!selected) return;
    const result = await dispatch(savePhotoMetadata({
      id: selected.id, shelter_id: selected.shelter_id, sheltersRoot,
      title: selected.title, photographer: selected.photographer,
      caption: selected.caption, alt_text: selected.alt_text,
      description: selected.description, notes: selected.notes,
      include_in_post: selected.include_in_post, date_taken: selected.date_taken,
      updated: new Date().toISOString().slice(0, 10), rotation: 0, flipped: false, crop: null,
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
        dispatch(updatePhotoLocal({ shelterId: s.id, photo: { id: selected.id, ...metadata, date_taken: normalizePhotoDateTaken(metadata.date_taken) } }));
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
      id: photo.id, shelter_id: photo.shelter_id, sheltersRoot,
      title: photo.title, photographer: photo.photographer, caption: photo.caption,
      alt_text: photo.alt_text, description: photo.description, notes: photo.notes,
      include_in_post: newValue, date_taken: photo.date_taken,
      updated: new Date().toISOString().slice(0, 10), rotation: 0, flipped: false, crop: null,
    }));
  };

  const handleSelect = (id: number) => setSelectedId(id);
  const handleOpenEditor = (id: number) => { setSelectedId(id); setEditorOpen(true); };
  const handleReconcileClose = (applied: boolean) => {
    setReconcileOpen(false);
    if (applied) dispatch(loadPhotos(s.id));
  };

  const itemHandlers = { onSelect: handleSelect, onOpenEditor: handleOpenEditor, onToggleInclude: handleToggleInclude };

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
            <button className="btn sm ghost" onClick={() => setReconcileOpen(true)}>Reconcile</button>
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

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/tiff,image/webp" style={{ display: 'none' }} onChange={handleFileInput} />

        <div
          className={`upload-zone ${dragOver ? 'drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="upload-zone-text">
              <span className="upload-title">Drop photographs here</span>
              <span className="upload-sub">JPEG, PNG, TIFF · stored in <code style={{ fontFamily: 'var(--font-mono)' }}>/shelters/{s.slug}/photos/</code></span>
            </div>
          </div>
          <button className="btn sm primary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>Browse files</button>
        </div>

        {photos.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', border: '1px dashed var(--line-2)', borderRadius: 8, color: 'var(--ink-3)', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}>
            No photographs in this record&apos;s folder yet.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
            <SortableContext items={photoIds} strategy={view === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}>
              {view === 'grid' ? (
                <div className="photos-grid">
                  {photos.map((p, i) => <PhotoCard key={p.id} {...photoItemProps(p, i, s.default_photo_id, selectedId, itemHandlers, repoRoot, sheltersRoot, version)} />)}
                </div>
              ) : (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line-2)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: LIST_ROW_GRID, padding: LIST_ROW_PAD, fontFamily: 'var(--font-mono)', fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', background: 'var(--surface-2)', borderBottom: '1px solid var(--line)' }}>
                    <span /><span>Title</span><span>Photographer</span><span>Date</span><span>ID</span>
                    <span style={{ textAlign: 'right' }}>Post</span>
                  </div>
                  {photos.map((p, i) => <ListRow key={p.id} {...photoItemProps(p, i, s.default_photo_id, selectedId, itemHandlers, repoRoot, sheltersRoot, version)} />)}
                </div>
              )}
            </SortableContext>
            <DragOverlay>
              {activeDragPhoto ? (
                view === 'grid' ? (
                  <PhotoCardOverlay {...photoItemProps(activeDragPhoto, Math.max(0, photos.findIndex((p) => p.id === activeDragPhoto.id)), s.default_photo_id, selectedId, itemHandlers, repoRoot, sheltersRoot, version)} />
                ) : (
                  <ListRowOverlay {...photoItemProps(activeDragPhoto, Math.max(0, photos.findIndex((p) => p.id === activeDragPhoto.id)), s.default_photo_id, selectedId, itemHandlers, repoRoot, sheltersRoot, version)} />
                )
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {pendingDeleteId !== null && (
        <ConfirmDialog
          message="Are you sure you want to permanently delete this photograph? This will also remove the file from your computer."
          confirmLabel="Delete"
          onConfirm={() => handleDeletePhoto(pendingDeleteId)}
          onCancel={() => setPendingDeleteId(null)}
        />
      )}

      {pendingMoveId !== null && (
        <MovePhotoDialog
          shelters={allShelters}
          currentShelterId={s.id}
          onConfirm={(targetShelterId) => handleMovePhoto(pendingMoveId, targetShelterId)}
          onCancel={() => setPendingMoveId(null)}
        />
      )}

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
        <PhotoDetailPane
          selected={selected}
          shelterId={s.id}
          shelterSlug={s.slug}
          isDefault={s.default_photo_id === selected.id}
          selectedIdx={selectedIdx}
          selectedPhotoUrl={selectedPhotoUrl}
          editorPhotoUrl={editorPhotoUrl}
          isMetadataDirty={isMetadataDirty}
          detailWidth={detailWidth}
          resizing={resizing}
          sheltersRoot={sheltersRoot}
          editorOpen={editorOpen}
          metadataOpen={metadataOpen}
          onStartResize={startResize}
          onOpenMetadata={() => setMetadataOpen(true)}
          onSetDefault={() => handleSetDefault(selected.id)}
          onExport={handleExportPhoto}
          onDelete={() => setPendingDeleteId(selected.id)}
          onMove={() => setPendingMoveId(selected.id)}
          canMove={allShelters.length > 1}
          onUpdatePhoto={(patch) => updatePhoto(selected.id, patch)}
          onSaveMetadata={handleSaveMetadata}
          onImportMetadata={handleImportMetadata}
          onOpenEditor={() => setEditorOpen(true)}
          onEditorSave={() => { setEditorOpen(false); setVersion((v) => v + 1); }}
          onEditorCancel={() => setEditorOpen(false)}
          onMetadataClose={() => setMetadataOpen(false)}
        />
      )}
    </div>
  );
}
