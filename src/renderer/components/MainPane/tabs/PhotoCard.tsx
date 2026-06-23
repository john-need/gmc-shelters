import { useState, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Photo } from '../../../../shared/ipc-types';
import IncludeInPostCheckbox from '../../ui/IncludeInPostCheckbox';

const TONE_GRADS: Record<string, string> = {
  warm: 'linear-gradient(135deg, #c9a36b 0%, #8a5b32 100%)',
  cool: 'linear-gradient(135deg, #8a9e9d 0%, #4f6464 100%)',
  neutral: 'linear-gradient(135deg, #a89b80 0%, #6a5d44 100%)',
};

export function photoBackground(idx: number) {
  const tones = ['warm', 'cool', 'neutral'];
  const tone = tones[idx % 3];
  return `repeating-linear-gradient(45deg, rgba(0,0,0,0.07) 0 2px, transparent 2px 14px), ${TONE_GRADS[tone]}`;
}

const noop = () => {};

export interface PhotoCardBodyProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  onToggleInclude: (id: number, newValue: boolean) => void;
  photoUrl: string;
}

// Memoised so the image-bearing subtree is skipped on dnd-kit's per-threshold
// re-renders of the sortable wrapper. Props (p, photoUrl, stable callbacks) are
// referentially stable during a drag, so the body never re-renders mid-drag.
export const PhotoCardBody = memo(function PhotoCardBody({ p, idx, isDefault, onToggleInclude, photoUrl }: PhotoCardBodyProps) {
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
        {isDefault && (
          <span className="photo-default-badge">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            default
          </span>
        )}
      </div>
      <div className="photo-info">
        <span className="photo-title">{p.title || 'Untitled'}</span>
        <div className="photo-meta">
          <label
            style={{ display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer', fontSize: 10 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title="Include in published post"
          >
            <IncludeInPostCheckbox photoId={p.id} checked={!!p.include_in_post} onToggle={onToggleInclude} />
            Post on web
          </label>
        </div>
      </div>
    </>
  );
});

export interface PhotoCardProps extends PhotoCardBodyProps {
  isSelected: boolean;
  onSelect: (id: number) => void;
  onOpenEditor: (id: number) => void;
}

export const PhotoCard = memo(function PhotoCard({ p, idx, isDefault, isSelected, onSelect, onOpenEditor, onToggleInclude, photoUrl }: PhotoCardProps) {
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

export function PhotoCardOverlay({ p, idx, isDefault, photoUrl }: PhotoCardBodyProps) {
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
