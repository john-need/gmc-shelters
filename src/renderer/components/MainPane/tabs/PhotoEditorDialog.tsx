import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store';
import type { Photo } from '../../../../shared/ipc-types';
import { savePhotoMetadata } from '../../../store/photosSlice';
import { showToast } from '../../../store/uiSlice';
import { screenToLocalDelta } from '../../../utils/cropUtils';

interface Props {
  photo: Photo;
  photoUrl: string;
  shelterId: number;
  sheltersRoot: string;
  isDefault: boolean;
  onSave: () => void;
  onCancel: () => void;
}

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

interface TransformSidebarProps {
  rotation: number;
  flipped: boolean;
  cropping: boolean;
  naturalSize: { w: number; h: number } | null;
  cropRect: { x: number; y: number; w: number; h: number };
  zoom: number;
  onRotateLeft: () => void;
  onRotateRight: () => void;
  onFlip: () => void;
  onToggleCrop: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  setCropRect: React.Dispatch<React.SetStateAction<{ x: number; y: number; w: number; h: number }>>;
  setCrop: (v: { x: number; y: number; width: number; height: number } | null) => void;
  setCropping: (v: boolean) => void;
}

function TransformSidebar({
  rotation: _rotation, flipped, cropping, naturalSize, cropRect, zoom,
  onRotateLeft, onRotateRight, onFlip, onToggleCrop,
  onZoomOut, onZoomIn,
}: TransformSidebarProps) {
  return (
    <div className="photo-editor-sidebar">
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
          Transform
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn icon sm" title="Rotate 90° left" onClick={onRotateLeft}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9c-2.5 0-4.8 1-6.5 2.6L3 8"/><path d="M3 3v5h5"/>
              </svg>
            </button>
            <button className="btn icon sm" title="Rotate 90° right" onClick={onRotateRight}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.5 0 4.8 1 6.5 2.6L21 8"/><path d="M21 3v5h-5"/>
              </svg>
            </button>
            <button className="btn icon sm" title="Flip horizontal" aria-pressed={flipped} onClick={onFlip}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18"/><path d="M16 7h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3"/><path d="M8 7H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3"/>
              </svg>
            </button>
          </div>
          <button
            className={`btn sm ${cropping ? 'primary' : ''}`}
            onClick={() => onToggleCrop()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>
            </svg>
            {' '}{cropping ? 'Done' : 'Crop'}
          </button>
          {cropping && naturalSize && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-4)', marginTop: 2 }}>
              {Math.round(naturalSize.w * cropRect.w / 100)}×{Math.round(naturalSize.h * cropRect.h / 100)}px
            </div>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
          Zoom
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="btn icon sm" onClick={onZoomOut}>−</button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', minWidth: 36, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button className="btn icon sm" onClick={onZoomIn}>+</button>
        </div>
      </div>
    </div>
  );
}

export default function PhotoEditorDialog({
  photo, photoUrl, sheltersRoot, isDefault, onSave, onCancel,
}: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const dialogRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  const priorFocusRef = useRef<Element | null>(null);

  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [cropRect, setCropRect] = useState({ x: 12, y: 14, w: 70, h: 68 });
  const [crop, setCrop] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [frameSize, setFrameSize] = useState<{ w: number; h: number } | null>(null);

  // Capture prior focus for restoration when dialog closes
  useEffect(() => {
    priorFocusRef.current = document.activeElement;
    return () => {
      (priorFocusRef.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  // Single keydown listener: Tab focus trap + Escape → cancel (FR-006, FR-012)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const renderedImageRect = naturalSize && frameSize
    ? (() => {
        const scale = Math.min(frameSize.w / naturalSize.w, frameSize.h / naturalSize.h);
        const iw = naturalSize.w * scale;
        const ih = naturalSize.h * scale;
        return { left: (frameSize.w - iw) / 2, top: (frameSize.h - ih) / 2, width: iw, height: ih };
      })()
    : null;

  const startCropDrag = useCallback(
    (type: 'move' | 'tl' | 'tr' | 'bl' | 'br', e: React.MouseEvent<HTMLElement>) => {
      e.stopPropagation();
      const overlay = cropOverlayRef.current;
      if (!overlay) return;
      const r = overlay.getBoundingClientRect();
      const startX = e.clientX;
      const startY = e.clientY;
      const startRect = { ...cropRect };
      const MIN = 5;

      const onMove = (me: MouseEvent) => {
        const sdx = ((me.clientX - startX) / r.width) * 100;
        const sdy = ((me.clientY - startY) / r.height) * 100;
        const { dx, dy } = screenToLocalDelta(sdx, sdy, rotation, flipped);
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
    },
    [cropRect, rotation, flipped],
  );

  // FR-004: Save persists only image edits; zero-delta is a no-op close (FR-009)
  const handleSave = async () => {
    if (rotation === 0 && !flipped && crop === null) {
      onSave();
      return;
    }
    setSaving(true);
    try {
      const result = await dispatch(savePhotoMetadata({
        id: photo.id,
        shelter_id: photo.shelter_id,
        sheltersRoot,
        title: photo.title,
        photographer: photo.photographer,
        caption: photo.caption,
        alt_text: photo.alt_text,
        description: photo.description,
        notes: photo.notes,
        include_in_post: photo.include_in_post,
        date_taken: photo.date_taken,
        updated: new Date().toISOString().slice(0, 10),
        rotation: rotation % 360,
        flipped,
        crop,
      }));
      if (savePhotoMetadata.fulfilled.match(result)) {
        onSave();
      } else {
        dispatch(showToast({ id: Date.now().toString(), message: 'Save failed. Please try again.' }));
        setSaving(false);
      }
    } catch {
      dispatch(showToast({ id: Date.now().toString(), message: 'Save failed. Please try again.' }));
      setSaving(false);
    }
  };

  const initial = photo.title ? photo.title.charAt(0) : photo.file_name.charAt(0).toUpperCase();

  // After Done, preview only the cropped region. A clip box sized to the crop's
  // fitted rect (centred in the frame) masks everything outside the crop, while
  // the full image inside is scaled and offset so the crop's top-left aligns to
  // the box origin. Sizing the clip box to the crop — not the frame — is what
  // keeps surrounding pixels from bleeding in along the letterbox axis.
  const cropPreview: { clip: React.CSSProperties; img: React.CSSProperties } | null =
    (crop && !cropping && naturalSize && frameSize)
      ? (() => {
          const { w: fw, h: fh } = frameSize;
          const fitScale = Math.min(fw / crop.width, fh / crop.height);
          const clipW = crop.width * fitScale;
          const clipH = crop.height * fitScale;
          return {
            // Centre via translate, not measured-pixel offsets: the frame size is
            // snapshotted in onLoad and may be captured mid-entrance-animation
            // (scale 0.96), so deriving the position from it lands the crop up-and-
            // left of true centre. Translate keeps it centred whatever the snapshot.
            clip: {
              position: 'absolute' as const,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: clipW,
              height: clipH,
              overflow: 'hidden',
            },
            img: {
              position: 'absolute' as const,
              left: -crop.x * fitScale,
              top: -crop.y * fitScale,
              width: naturalSize.w * fitScale,
              height: naturalSize.h * fitScale,
            },
          };
        })()
      : null;

  return (
    <div
      className="modal-bg"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={dialogRef}
        className="photo-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit photo: ${photo.title || photo.file_name}`}
      >
        {/* Header */}
        <div className="photo-editor-header">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 16 }}>
              {photo.title || 'Untitled'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em', marginTop: 2 }}>
              {photo.file_name}
            </div>
          </div>
          <button className="btn icon sm" aria-label="Close" onClick={onCancel}>✕</button>
        </div>

        {/* Body: large preview + tool sidebar */}
        <div className="photo-editor-body">
          <div className="photo-editor-preview">
            <div
              ref={frameRef}
              className="photo-preview-frame"
              style={{
                width: '90%',
                height: '90%',
                transform: `rotate(${rotation}deg) scale(${zoom}) scaleX(${flipped ? -1 : 1})`,
                position: 'relative',
                overflow: cropping ? 'visible' : 'hidden',
              }}
            >
              {photoUrl ? (
                cropPreview ? (
                  <div className="crop-preview-clip" style={cropPreview.clip}>
                    <img
                      key={`${photoUrl}-crop`}
                      src={photoUrl}
                      alt={photo.alt_text || photo.title || photo.file_name}
                      style={cropPreview.img}
                    />
                  </div>
                ) : (
                  <PhotoPreviewImage
                    key={photoUrl}
                    src={photoUrl}
                    alt={photo.alt_text || photo.title || photo.file_name}
                    fallback={initial}
                    onLoad={(img) => {
                      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                      if (frameRef.current) {
                        // offsetWidth/Height give the untransformed layout box. The
                        // dialog's `pop` entrance animation scales the frame, so a
                        // getBoundingClientRect here would report a shrunken size and
                        // misplace the crop overlay and preview.
                        setFrameSize({ w: frameRef.current.offsetWidth, h: frameRef.current.offsetHeight });
                      }
                    }}
                  />
                )
              ) : (
                <span className="glyph">{initial}</span>
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
            {isDefault && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: 'var(--forest)', color: 'var(--surface)',
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '3px 8px', borderRadius: 2,
              }}>★ Default</div>
            )}
          </div>

          {/* Tool sidebar */}
          <TransformSidebar
            rotation={rotation}
            flipped={flipped}
            cropping={cropping}
            naturalSize={naturalSize}
            cropRect={cropRect}
            zoom={zoom}
            onRotateLeft={() => setRotation((r) => r - 90)}
            onRotateRight={() => setRotation((r) => r + 90)}
            onFlip={() => setFlipped((x) => !x)}
            onToggleCrop={() => {
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
            }}
            onZoomOut={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            onZoomIn={() => setZoom((z) => Math.min(2, z + 0.1))}
            setCropRect={setCropRect}
            setCrop={setCrop}
            setCropping={setCropping}
          />
        </div>

        {/* Footer: Save + Cancel (FR-004, FR-005, FR-010) */}
        <div className="photo-editor-footer">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn primary"
            disabled={saving || cropping}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
