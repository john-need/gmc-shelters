import { useEffect, useRef } from 'react';
import type { Photo } from '../../../../shared/ipc-types';
import PhotoPreviewImage from '../../ui/PhotoPreviewImage';
import { photoBackground } from './PhotoCard';
import PhotoEditorDialog from './PhotoEditorDialog';
import PhotoMetadataDialog from './PhotoMetadataDialog';

export interface PhotoDetailPaneProps {
  selected: Photo;
  shelterId: number;
  shelterSlug: string;
  isDefault: boolean;
  selectedIdx: number;
  selectedPhotoUrl: string;
  editorPhotoUrl: string;
  isMetadataDirty: boolean;
  detailWidth: number;
  resizing: boolean;
  sheltersRoot: string;
  editorOpen: boolean;
  metadataOpen: boolean;
  onStartResize: (e: React.MouseEvent) => void;
  onOpenMetadata: () => void;
  onSetDefault: () => void;
  onExport: () => void;
  onDelete: () => void;
  onMove: () => void;
  canMove: boolean;
  onUpdatePhoto: (patch: Partial<Photo>) => void;
  onSaveMetadata: () => void;
  onImportMetadata: () => void;
  onOpenEditor: () => void;
  onEditorSave: () => void;
  onEditorCancel: () => void;
  onMetadataClose: () => void;
}

export default function PhotoDetailPane({
  selected, shelterId, shelterSlug, isDefault, selectedIdx, selectedPhotoUrl, editorPhotoUrl,
  isMetadataDirty, detailWidth, resizing, sheltersRoot,
  editorOpen, metadataOpen,
  onStartResize, onOpenMetadata, onSetDefault, onExport, onDelete, onMove, canMove,
  onUpdatePhoto, onSaveMetadata, onImportMetadata,
  onOpenEditor, onEditorSave, onEditorCancel, onMetadataClose,
}: PhotoDetailPaneProps) {
  const fieldsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fieldsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selected.id]);

  return (
    <>
      <div
        className={`photos-resize-handle${resizing ? ' dragging' : ''}`}
        onMouseDown={onStartResize}
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
            <button className="btn icon sm" aria-label="View photo metadata" title="View photo metadata" onClick={onOpenMetadata}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
              </svg>
            </button>
            <button className="btn icon sm" title="Set as default photo" onClick={onSetDefault}>
              {isDefault ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="var(--forest)" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              )}
            </button>
            <button className="btn icon sm" aria-label="Export photo" title="Export photo" onClick={onExport}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>
              </svg>
            </button>
            <button className="btn icon sm" title="Move to shelter" disabled={!canMove} onClick={onMove}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
              </svg>
            </button>
            <button className="btn icon sm" title="Delete photo" onClick={onDelete}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        </div>

        <div
          data-testid="photo-preview"
          className="photo-preview photo-preview-clickable"
          onClick={onOpenEditor}
          style={{ position: 'relative' }}
        >
          <div className="photo-preview-frame" style={{ background: photoBackground(selectedIdx), position: 'relative', overflow: 'hidden' }}>
            {selectedPhotoUrl ? (
              <PhotoPreviewImage
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
          {isDefault && (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'var(--forest)', color: 'var(--surface)',
              fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: 2,
            }}>★ Default</div>
          )}
        </div>

        <div className="photo-fields" ref={fieldsRef}>
          <div className="field">
            <label className="label">Title</label>
            <input className="input" value={selected.title || ''} onChange={(e) => onUpdatePhoto({ title: e.target.value })} />
          </div>

          <div className="row-2">
            <div className="field">
              <label className="label">Photographer</label>
              <input className="input" value={selected.photographer || ''} onChange={(e) => onUpdatePhoto({ photographer: e.target.value })} />
            </div>
            <div className="field">
              <label className="label">Date taken</label>
              <input
                aria-label="Date taken"
                className="input mono"
                type="text"
                placeholder="YYYY or YYYY-MM-DD"
                value={selected.date_taken || ''}
                onChange={(e) => onUpdatePhoto({ date_taken: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label className="label">Caption <span className="hint">public</span></label>
            <textarea className="textarea" rows={2} value={selected.caption || ''} onChange={(e) => onUpdatePhoto({ caption: e.target.value })} />
          </div>

          <div className="field">
            <label className="label">Alt text <span className="hint">accessibility</span></label>
            <textarea className="textarea" rows={2} value={selected.alt_text || ''} onChange={(e) => onUpdatePhoto({ alt_text: e.target.value })} />
          </div>

          <div className="field">
            <label className="label">Description</label>
            <textarea className="textarea" rows={2} value={selected.description || ''} onChange={(e) => onUpdatePhoto({ description: e.target.value })} />
          </div>

          <div className="field">
            <label className="label">Internal notes</label>
            <textarea className="textarea" rows={2} value={selected.notes || ''} onChange={(e) => onUpdatePhoto({ notes: e.target.value })} />
          </div>

          <div
            className={`check ${selected.include_in_post ? 'on' : ''}`}
            onClick={() => onUpdatePhoto({ include_in_post: !selected.include_in_post })}
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
            <span>shelter_id: {shelterId}</span>
          </div>

          <div className="row-2" style={{ marginTop: 8 }}>
            <button className={`btn ${isMetadataDirty ? 'primary' : ''}`} onClick={onSaveMetadata} disabled={!isMetadataDirty}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
              </svg>
              {' '}Save Metadata
            </button>
            <button className="btn ghost sm" title="Copy file metadata values into the editorial record" onClick={onImportMetadata}>
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
          photoUrl={editorPhotoUrl}
          shelterId={shelterId}
          sheltersRoot={sheltersRoot}
          isDefault={isDefault}
          onSave={onEditorSave}
          onCancel={onEditorCancel}
        />
      )}
      {metadataOpen && (
        <PhotoMetadataDialog
          photo={selected}
          shelterId={shelterId}
          slug={shelterSlug}
          sheltersRoot={sheltersRoot}
          onClose={onMetadataClose}
        />
      )}
    </>
  );
}
